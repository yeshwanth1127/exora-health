import inputStyles from "../arc/input/input.module.css";
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn("arc-demo-scope arc-native-input w-full min-w-0", inputStyles.input, className)}
      {...props}
    />
  )
}

export { Input }
