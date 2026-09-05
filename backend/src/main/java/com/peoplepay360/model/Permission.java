package com.peoplepay360.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "permission")
public class Permission {
    @Id
    private String code;
    private String resource;
    private String action;
    private String scope;
    private String tier;
    private boolean grantable;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(columnDefinition = "text[]")
    private String[] implies = new String[0];
    private String description;
    public String getCode() { return code; }
    public String getResource() { return resource; }
    public String getAction() { return action; }
    public String getScope() { return scope; }
    public String getTier() { return tier; }
    public boolean isGrantable() { return grantable; }
    public String[] getImplies() { return implies; }
    public String getDescription() { return description; }
}
