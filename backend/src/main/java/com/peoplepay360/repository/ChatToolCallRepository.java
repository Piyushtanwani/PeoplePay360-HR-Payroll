package com.peoplepay360.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import com.peoplepay360.model.ChatToolCall;

public interface ChatToolCallRepository extends JpaRepository<ChatToolCall, Long> {
    List<ChatToolCall> findByMessageId(Long messageId);
}
