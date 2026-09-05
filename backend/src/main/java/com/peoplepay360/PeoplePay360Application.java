package com.peoplepay360;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@org.springframework.boot.context.properties.ConfigurationPropertiesScan
@EnableCaching
@EnableAsync
@EnableScheduling
public class PeoplePay360Application {
    public static void main(String[] args) {
        SpringApplication.run(PeoplePay360Application.class, args);
    }
}
