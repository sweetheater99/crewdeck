import type { AdapterConfigFieldsProps } from "../types";
import {
  Field,
  DraftInput,
  help,
} from "../../components/agent-config-primitives";

const inputClass =
  "w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40";

export function StatusMonitorConfigFields({
  isCreate,
  values,
  set,
  config,
  eff,
  mark,
}: AdapterConfigFieldsProps) {
  return (
    <>
      <Field label="Command" hint="Shell command to run for health check (executed via bash -c)">
        <DraftInput
          value={
            isCreate
              ? values!.command
              : eff("adapterConfig", "command", String(config.command ?? ""))
          }
          onCommit={(v) =>
            isCreate
              ? set!({ command: v })
              : mark("adapterConfig", "command", v || undefined)
          }
          immediate
          className={inputClass}
          placeholder='e.g. systemctl is-active myservice && tail -5 /var/log/myservice.log'
        />
      </Field>
    </>
  );
}
