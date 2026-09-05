package com.peoplepay360.config;

import com.nimbusds.jose.jwk.RSAKey;
import com.peoplepay360.security.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.interfaces.RSAPublicKey;

@Configuration
public class JwtConfig {
    private final AppProperties props;
    public JwtConfig(AppProperties props) { this.props = props; }

    @Bean
    public JwtDecoder jwtDecoder(JwtService jwtService) throws Exception {
        RSAKey pub = jwtService.publicKey();
        RSAPublicKey key = pub.toRSAPublicKey();
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withPublicKey(key).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(props.getJwt().getIssuer()));
        return decoder;
    }
}
