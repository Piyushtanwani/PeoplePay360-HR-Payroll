package com.peoplepay360.security;

import com.peoplepay360.config.CacheConfig;
import com.peoplepay360.repository.AppUserRepository;
import com.peoplepay360.repository.EffectivePermissionRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/** Single authority-resolution path. Loads effective permissions from the database view, cached per user. */
@Service
public class AuthorityService {
    private final EffectivePermissionRepository perms;
    private final AppUserRepository users;

    public AuthorityService(EffectivePermissionRepository perms, AppUserRepository users) {
        this.perms = perms;
        this.users = users;
    }

    @Cacheable(cacheNames = CacheConfig.AUTHORITIES, key = "#userId")
    public List<GrantedAuthority> loadAuthorities(Long userId) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        for (String code : perms.findCodesByUserId(userId)) {
            authorities.add(new SimpleGrantedAuthority(code));
        }
        users.findById(userId).ifPresent(u ->
                authorities.add(new SimpleGrantedAuthority("ROLE_" + u.getRole().getCode())));
        return authorities;
    }

    @CacheEvict(cacheNames = CacheConfig.AUTHORITIES, key = "#userId")
    public void evict(Long userId) { }
}
