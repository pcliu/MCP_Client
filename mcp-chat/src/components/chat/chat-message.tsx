'use client'

import { Message } from "@/types/chat"
import { cn } from "@/lib/utils"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "flex w-full items-start gap-4 p-4",
        message.role === "user" ? "bg-muted/50" : "bg-background"
      )}
    >
      <div className="flex-1 space-y-2">
        <div className="prose break-words">
          <p className={cn(
            "text-sm",
            message.role === "user" ? "text-primary" : "text-foreground"
          )}>
            {message.content}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  )
} 