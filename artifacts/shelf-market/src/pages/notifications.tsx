import { useState } from "react";
import { Link } from "wouter";
import { Shell, PageTitle } from "@/components/shell";
import { Empty, Notice, SmallButton, Tabs } from "@/components/kit";
import { useStore } from "@/lib/store";
import { actions } from "@/lib/actions";
import { ROLE_LABEL } from "@/lib/ops";
import { fmtTime } from "@/lib/util";
import type { Role } from "@/lib/types";

export default function Notifications() {
  const st = useStore();
  const [role, setRole] = useState<string>(st.role);
  const list = st.notifications.filter((n) => n.role === role).slice().reverse();
  const unread = (r: Role) => st.notifications.filter((n) => n.role === r && !n.read).length;
  return (
    <Shell title="Notifications" back="/">
      <PageTitle title="Notifications" sub="Created by actions in this demo.">
        <Tabs value={role} onChange={setRole} options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ id: r, label: ROLE_LABEL[r], count: unread(r) }))} />
      </PageTitle>
      <div className="mx-auto mt-6 max-w-2xl space-y-3">
        <Notice tone="mute">In-app only. Email, SMS and messaging apps are not connected in this demo.</Notice>
        {list.length > 0 && <div className="flex justify-end"><SmallButton onClick={() => actions.markRead(role as Role)} testId="button-mark-all">Mark all read</SmallButton></div>}
        {list.length === 0 && <Empty title="All quiet" text="Nothing for this role yet." />}
        {list.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 rounded-3xl border p-4 ${n.read ? "border-border" : "border-primary/40 bg-primary/5"}`} data-testid={`row-notification-${n.id}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-muted" : "bg-primary"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmtTime(n.at)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {n.link && <Link href={n.link} onClick={() => actions.markRead(role as Role, n.id)} className="text-sm text-primary underline" data-testid={`link-notification-${n.id}`}>Open</Link>}
              {!n.read && <button onClick={() => actions.markRead(role as Role, n.id)} className="text-xs text-muted-foreground hover:text-foreground" data-testid={`button-read-${n.id}`}>Mark read</button>}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
