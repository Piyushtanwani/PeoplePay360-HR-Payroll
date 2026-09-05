package com.peoplepay360.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Builds authorities for every token from the database, ignoring the roles and perms claims for authorisation. */
@Component
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    private final AuthorityService authorityService;
    public JwtAuthConverter(AuthorityService authorityService) { this.authorityService = authorityService; }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        Long userId = Long.valueOf(jwt.getSubject());
        return new JwtAuthenticationToken(jwt, authorityService.loadAuthorities(userId), jwt.getSubject());
    }
}
