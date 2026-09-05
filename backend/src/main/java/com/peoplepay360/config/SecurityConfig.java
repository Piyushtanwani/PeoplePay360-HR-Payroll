package com.peoplepay360.config;

import com.peoplepay360.security.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(10); }

    @Bean
    public SecurityFilterChain filterChain(
            HttpSecurity http,
            JwtAuthConverter jwtAuthConverter,
            ChatChannelFilter chatChannelFilter,
            ProblemAuthEntryPoint authEntryPoint,
            ProblemAccessDeniedHandler accessDeniedHandler,
            UrlBasedCorsConfigurationSource cors) throws Exception {

        http
            .cors(c -> c.configurationSource(cors))
            .csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers(
                        "/api/auth/login",
                        "/api/auth/forgot-password",
                        // Reached from an emailed link, before the user has any credentials.
                        "/api/auth/set-password", "/api/auth/set-password/check",
                        "/.well-known/jwks.json",
                        "/actuator/health", "/actuator/info",
                        "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(jwtAuthConverter)))
            .exceptionHandling(e -> e
                .authenticationEntryPoint(authEntryPoint)
                .accessDeniedHandler(accessDeniedHandler))
            .addFilterAfter(chatChannelFilter, BearerTokenAuthenticationFilter.class);

        return http.build();
    }
}
