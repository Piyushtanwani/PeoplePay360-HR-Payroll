package com.peoplepay360.controller;

import com.peoplepay360.dto.EmployeeDtos.EmployeeDetail;
import com.peoplepay360.dto.IdentityDtos.ChangePassword;
import com.peoplepay360.dto.IdentityDtos.MyProfile;
import com.peoplepay360.dto.IdentityDtos.UpdateMyBank;
import com.peoplepay360.dto.IdentityDtos.UpdateMyProfile;
import com.peoplepay360.service.SelfServiceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

/** Everything a signed-in person may change about themselves. Scope is always the caller. */
@RestController
@RequestMapping("/api/me")
public class MeController {
    private final SelfServiceService service;

    public MeController(SelfServiceService service) {
        this.service = service;
    }

    @GetMapping("/profile")
    public MyProfile profile() {
        return service.profile();
    }

    @PutMapping("/profile")
    public MyProfile updateProfile(@Valid @RequestBody UpdateMyProfile in) {
        return service.updateProfile(in);
    }

    @PutMapping("/bank-account")
    public EmployeeDetail updateBankAccount(@Valid @RequestBody UpdateMyBank in) {
        return service.updateBankAccount(in);
    }

    @PostMapping("/change-password")
    public void changePassword(@Valid @RequestBody ChangePassword in, HttpServletRequest request) {
        service.changePassword(in, request.getRemoteAddr());
    }
}
