package com.peoplepay360.unit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.peoplepay360.common.audit.AuditService;
import com.peoplepay360.common.audit.AuditWriter;
import com.peoplepay360.common.audit.Channel;
import com.peoplepay360.model.AuditEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The before/after columns are Postgres json, and auditing swallows its own failures so a request is
 * never broken by its own trail. Together those meant a bad value produced no row and no complaint,
 * which is the worst possible outcome for a record of who changed somebody's bank account.
 */
class AuditServiceTest {

    /** Captures what would have been written, in place of the database. */
    static class CapturingWriter extends AuditWriter {
        final List<AuditEvent> written = new ArrayList<>();
        CapturingWriter() { super(null); }
        @Override public void write(AuditEvent e) { written.add(e); }
    }

    private CapturingWriter writer;
    private AuditService audit;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        writer = new CapturingWriter();
        mapper = new ObjectMapper();
        audit = new AuditService(writer, mapper);
    }

    private AuditEvent only() {
        assertThat(writer.written).hasSize(1);
        return writer.written.get(0);
    }

    @Test
    void aPlainValueIsStoredAsAJsonString() throws Exception {
        audit.record(Channel.UI, "UPDATE_OWN_PROFILE", "user", "5", "ALLOW", null, "Sam Patel", "Sam P.");

        AuditEvent e = only();
        assertThat(mapper.readTree(e.getBeforeJson()).asText()).isEqualTo("Sam Patel");
        assertThat(mapper.readTree(e.getAfterJson()).asText()).isEqualTo("Sam P.");
    }

    @Test
    void aMaskedAccountNumberIsStoredRatherThanDiscarded() throws Exception {
        audit.record(Channel.UI, "SET_OWN_BANK", "employee", "5", "ALLOW", null, "****4321", "****9876");

        AuditEvent e = only();
        assertThat(mapper.readTree(e.getAfterJson()).asText()).isEqualTo("****9876");
    }

    @Test
    void anAlreadySerialisedObjectIsLeftExactlyAsItIs() throws Exception {
        String before = audit.toJson(Map.of("wage", 50000));

        audit.record(Channel.UI, "UPDATE_CONTRACT", "contract", "3", "ALLOW", null, before, null);

        assertThat(mapper.readTree(only().getBeforeJson()).get("wage").asInt()).isEqualTo(50000);
    }

    @Test
    void nothingIsRecordedForAnAbsentValue() {
        audit.record(Channel.UI, "READ", "employee", "5", "ALLOW", null, null, "   ");

        AuditEvent e = only();
        assertThat(e.getBeforeJson()).isNull();
        assertThat(e.getAfterJson()).isNull();
    }

    @Test
    void theReasonIsNotTouched() {
        audit.record(Channel.UI, "RESOLVE_EXCEPTION", "attendance", "11", "ALLOW",
                "Confirmed with their manager.", null, null);

        assertThat(only().getReason()).isEqualTo("Confirmed with their manager.");
    }

    @Test
    void aDenialRecordsWhichPermissionWasMissing() {
        audit.deny(Channel.CHAT, "PAYRUN_READ", "payrun", "3", "payrun.read");

        AuditEvent e = only();
        assertThat(e.getOutcome()).isEqualTo("DENY");
        assertThat(e.getReason()).isEqualTo("payrun.read");
        assertThat(e.getChannel()).isEqualTo("CHAT");
    }
}
