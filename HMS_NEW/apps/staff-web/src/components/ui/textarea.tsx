import textareaStyles from "../arc/textarea/textarea.module.css";
import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn("arc-demo-scope arc-native-textarea w-full min-w-0", textareaStyles.control, className)}
      {...props}
    />
  )
}

export { Textarea }
