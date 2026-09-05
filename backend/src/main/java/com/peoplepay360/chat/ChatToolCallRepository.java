package com.peoplepay360.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatToolCallRepository extends JpaRepository<ChatToolCall, Long> {
    List<ChatToolCall> findByMessageId(Long messageId);
}
