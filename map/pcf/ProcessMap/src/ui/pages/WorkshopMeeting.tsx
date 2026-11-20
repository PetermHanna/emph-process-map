// The meeting request in Prepare (Business Map N7): Teams opens a new meeting with the subject, time, attendees and the
// agenda filled in; the prep pack is a Word file to attach there before sending. Nothing is sent from here.
import * as React from "react";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Textarea } from "@fluentui/react-components";
import { CalendarAdd20Regular, DocumentText20Regular } from "@fluentui/react-icons";
import { useLook } from "../look";
import { agendaText, emailsIn, meetingMinutes, meetingSubject, prepPackHtml, teamsMeetingLink, PrepSection } from "../../domain/session";
import type { Workshop } from "../../domain/types";

const download = (name: string, html: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/msword" }));
  a.download = name.replace(/[\\/:*?"<>|]+/g, " ").trim(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

export function MeetingRequest({ w, organisation, what, lines, sections }: { w: Workshop; organisation: string; what: string[]; lines: { text: string; minutes?: number }[]; sections: PrepSection[] }) {
  const l = useLook();
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [start, setStart] = React.useState("");
  const [minutes, setMinutes] = React.useState("");
  const [mails, setMails] = React.useState("");
  const total = lines.reduce((n, x) => n + (x.minutes || 0), 0);
  const show = () => {
    setSubject(meetingSubject(organisation, what)); setStart((w.heldOn || new Date().toISOString().slice(0, 10)) + "T09:00");
    setMinutes(String(meetingMinutes(total || 90))); setMails(emailsIn(w.participants).join("\n")); setOpen(true);
  };
  const addresses = emailsIn(mails);
  const facts: [string, string][] = [["Workshop", w.name], ["Date", w.heldOn || "to be agreed"], ["Facilitator", w.facilitator || "to be named"]];
  const when = start ? new Date(start) : null;
  const ok = !!subject.trim() && !!when && !isNaN(when.getTime()) && Number(minutes) > 0;
  return (
    <>
      <Button size="small" data-emph="meeting-request" icon={<CalendarAdd20Regular />} onClick={show}>Meeting request</Button>
      <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
        <DialogSurface style={{ maxWidth: 560 }}><DialogBody>
          <DialogTitle>Meeting request</DialogTitle>
          <DialogContent style={{ display: "flex", flexDirection: "column", gap: 8 }} data-emph="meeting-form">
            <div className={l.muted} style={{ fontSize: 12 }}>Teams opens a new meeting with these fields and the agenda. Download the prep pack and attach it there before you send.</div>
            <Field label="Subject"><Input data-emph="meeting-subject" value={subject} onChange={(_, d) => setSubject(d.value)} /></Field>
            <div className={l.row}>
              <Field label="Starts"><Input data-emph="meeting-start" type="datetime-local" value={start} onChange={(_, d) => setStart(d.value)} /></Field>
              <Field label="Minutes" hint={total ? "Agenda: " + total + " min" : "No minutes on the agenda"}><Input data-emph="meeting-minutes" type="number" min={15} step={15} value={minutes} onChange={(_, d) => setMinutes(d.value)} style={{ width: 90 }} /></Field>
            </div>
            <Field label="Attendees' e-mail addresses" hint={addresses.length + " found. One per line, or separated by commas. Add them to the participants in Prepare to have them here next time."}>
              <Textarea data-emph="meeting-attendees" rows={3} value={mails} onChange={(_, d) => setMails(d.value)} placeholder="name@organisation.example" />
            </Field>
          </DialogContent>
          <DialogActions>
            <Button data-emph="meeting-pack" icon={<DocumentText20Regular />} onClick={() => download(w.name + " prep pack.doc", prepPackHtml((organisation ? organisation + ": " : "") + "workshop prep pack", facts, sections))}>Download the prep pack</Button>
            <Button data-emph="meeting-open" appearance="primary" disabled={!ok} onClick={() => window.open(teamsMeetingLink({ subject: subject.trim(), start: when!, minutes: Number(minutes), attendees: addresses, content: agendaText(lines) }), "_blank", "noopener")}>Open in Teams</Button>
          </DialogActions>
        </DialogBody></DialogSurface>
      </Dialog>
    </>
  );
}
