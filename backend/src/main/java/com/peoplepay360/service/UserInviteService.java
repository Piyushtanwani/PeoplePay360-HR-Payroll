package com.peoplepay360.service;

import com.peoplepay360.common.ApiException;
import com.peoplepay360.common.ErrorCode;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.config.AppProperties;
import com.peoplepay360.model.AppUser;
import com.peoplepay360.model.PasswordSetupToken;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.PasswordSetupTokenRepository;
import com.peoplepay360.security.PasswordResetRateLimiter;
import jakarta.mail.internet.MimeMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import com.peoplepay360.security.PasswordPolicy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;

/**
 * Invites a user to choose their own password. The admin never sets or sees it:
 * a single-use link is emailed, and only the token's hash is stored.
 */
@Service
public class UserInviteService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(UserInviteService.class);
    private static final int TOKEN_BYTES = 32;

    private final PasswordSetupTokenRepository tokens;
    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final JavaMailSender mailSender;
    private final AppProperties props;
    private final AuditService audit;
    private final PasswordResetRateLimiter resetLimiter;

    public UserInviteService(PasswordSetupTokenRepository tokens, AppUserRepository users, PasswordEncoder encoder,
                             JavaMailSender mailSender, AppProperties props, AuditService audit,
                             PasswordResetRateLimiter resetLimiter) {
        this.tokens = tokens;
        this.users = users;
        this.encoder = encoder;
        this.mailSender = mailSender;
        this.props = props;
        this.audit = audit;
        this.resetLimiter = resetLimiter;
    }

    private static String hash(String raw) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(d);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot hash token", e);
        }
    }

    /** Mints a fresh token, invalidating any outstanding one for the same user. */
    @Transactional
    public String mint(Long userId, String purpose, int ttlHours) {
        tokens.findByUserIdAndUsedAtIsNull(userId).forEach(t -> {
            t.setUsedAt(OffsetDateTime.now());
            tokens.save(t);
        });
        byte[] raw = new byte[TOKEN_BYTES];
        new SecureRandom().nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        PasswordSetupToken t = new PasswordSetupToken();
        t.setUserId(userId);
        t.setTokenHash(hash(token));
        t.setPurpose(purpose);
        t.setExpiresAt(OffsetDateTime.now().plusHours(ttlHours));
        tokens.save(t);
        return token;
    }

    /**
     * Emails the set-password link. Delivery failure does not roll back the invite:
     * the admin can resend, and a dead SMTP server should not block onboarding.
     */
    public boolean sendInvite(AppUser user, String token, boolean isReset) {
        String link = props.getAppBaseUrl() + "/set-password?token=" + token;
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            helper.setFrom(props.getMailFrom());
            helper.setTo(user.getEmail());
            helper.setSubject(isReset
                    ? "Reset your " + props.getCompanyName() + " password"
                    : "Set up your " + props.getCompanyName() + " account");
            helper.setText("""
                    Hello %s,

                    %s

                    Choose your password here (the link works once and expires in %d hours):
                    %s

                    If you were not expecting this email you can ignore it.

                    %s
                    """.formatted(
                    user.getDisplayName(),
                    isReset ? "A password reset was requested for your account."
                            : "An account has been created for you on " + props.getCompanyName() + " PeoplePay360.",
                    props.getInviteTtlHours(),
                    link,
                    props.getCompanyName()));
            mailSender.send(msg);
            log.info("Invite email sent to user {}", user.getId());
            return true;
        } catch (Exception e) {
            log.warn("Could not email the invite to user {}: {}", user.getId(), e.getMessage());
            return false;
        }
    }

    /** Consumes the token and sets the password. Public endpoint: never reveal why it failed. */
    @Transactional
    public void redeem(String token, String newPassword) {
        if (token == null || token.isBlank()) throw ApiException.validation("This link is not valid.");
        PasswordSetupToken t = tokens.findByTokenHash(hash(token))
                .filter(PasswordSetupToken::isUsable)
                .orElseThrow(() -> ApiException.validation("This link has expired or was already used."));

        AppUser user = users.findById(t.getUserId()).orElseThrow(() -> ApiException.notFound("user"));
        // Same rule as the self-service change form, so an account cannot end up with a password one
        // path would have refused.
        PasswordPolicy.validate(newPassword, user.getEmail());
        user.setPasswordHash(encoder.encode(newPassword));
        user.setActive(true);
        users.save(user);

        t.setUsedAt(OffsetDateTime.now());
        tokens.save(t);
        audit.record(Channel.SYSTEM, "PASSWORD_SET", "user", user.getId().toString(), "ALLOW",
                t.getPurpose(), null, null);
    }

    /**
     * Self-service reset entry point. Public endpoint: never reveal whether the email matched an account,
     * so success and "no such account" both return silently and only the rate limit can reject the call.
     */
    @Transactional
    public void requestPasswordReset(String email, String ip) {
        if (!resetLimiter.tryConsume(email, ip == null ? "unknown" : ip)) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many requests. Please wait and try again.");
        }
        users.findByEmailIgnoreCase(email).filter(AppUser::isActive).ifPresent(user -> {
            String token = mint(user.getId(), "PASSWORD_RESET", props.getInviteTtlHours());
            sendInvite(user, token, true);
        });
    }

    /**
     * Invalidates any outstanding invite or reset link for a user. Called after a password change so a
     * link that was already in someone's inbox cannot be used to change it back.
     */
    @Transactional
    public void invalidateOutstanding(Long userId) {
        for (PasswordSetupToken t : tokens.findByUserIdAndUsedAtIsNull(userId)) {
            t.setUsedAt(OffsetDateTime.now());
            tokens.save(t);
        }
    }

    /** Whether a token is still redeemable, so the page can show a clear message before asking for input. */
    @Transactional(readOnly = true)
    public boolean isTokenUsable(String token) {
        if (token == null || token.isBlank()) return false;
        return tokens.findByTokenHash(hash(token)).map(PasswordSetupToken::isUsable).orElse(false);
    }
}
