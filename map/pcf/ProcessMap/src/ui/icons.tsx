// Icons for end-to-end processes and process areas, picked from the catalog wording.
import * as React from "react";
import {
  Building20Regular, Key20Regular, Wrench20Regular, Briefcase20Regular, Money20Regular, PersonAdd20Regular, Receipt20Regular, Cart20Regular,
  BoxMultiple20Regular, DataTrending20Regular, Target20Regular, People20Regular, Wallet20Regular, Ruler20Regular, BuildingFactory20Regular,
  ShieldCheckmark20Regular, BuildingBank20Regular, Calculator20Regular, Book20Regular, Headset20Regular, Megaphone20Regular, VehicleTruck20Regular,
  DocumentSignature20Regular, Payment20Regular, Lightbulb20Regular, HatGraduation20Regular, Settings20Regular, ArrowUndo20Regular,
  CalendarLtr20Regular, Shield20Regular, Handshake20Regular, Toolbox20Regular,
} from "@fluentui/react-icons";
import type { FluentIcon } from "@fluentui/react-icons";

const END_TO_END: Record<string, FluentIcon> = {
  "10": Building20Regular, "20": Headset20Regular, "30": Lightbulb20Regular, "40": Ruler20Regular, "50": DataTrending20Regular, "55": People20Regular,
  "60": BoxMultiple20Regular, "65": Money20Regular, "70": BuildingFactory20Regular, "75": Cart20Regular, "80": Briefcase20Regular, "85": PersonAdd20Regular,
  "90": Book20Regular, "93": Key20Regular, "95": Wrench20Regular, "99": Settings20Regular,
};

// First match wins, so the more specific words come first.
const AREA_RULES: [RegExp, FluentIcon][] = [
  [/return/, ArrowUndo20Regular],
  [/inventory|warehouse|stock|inbound|outbound/, BoxMultiple20Regular],
  [/\bproducts?\b|offering|research/, Lightbulb20Regular],
  [/service operations|customer service/, Headset20Regular],
  [/rental|rent\b/, Key20Regular],
  [/maint|repair/, Wrench20Regular],
  [/service work|deliver services|field/, Toolbox20Regular],
  [/case|incident|support|knowledge|customer service/, Headset20Regular],
  [/project/, Briefcase20Regular],
  [/lead|prospect|opportunit|customer relationship/, PersonAdd20Regular],
  [/quot|estimat/, Calculator20Regular],
  [/receivable|invoice|billing|credit|collection/, Receipt20Regular],
  [/payable|payment/, Payment20Regular],
  [/procure|purchas|sourc|supplier|vendor/, Cart20Regular],
  [/transport|ship|logistic|freight|deliver/, VehicleTruck20Regular],
  [/produc|manufactur|shop floor/, BuildingFactory20Regular],
  [/quality/, ShieldCheckmark20Regular],
  [/design|engineer|bill of material/, Ruler20Regular],
  [/cash|bank|treasur/, BuildingBank20Regular],
  [/budget/, Calculator20Regular],
  [/close|record|ledger|accounting|financial|tax/, Book20Regular],
  [/market|campaign|brand/, Megaphone20Regular],
  [/payroll|compensation|benefit/, Wallet20Regular],
  [/learn|train|develop employee|career/, HatGraduation20Regular],
  [/hire|recruit|talent|workforce|employee|organi[sz]ation/, People20Regular],
  [/contract|agreement/, DocumentSignature20Regular],
  [/schedul|calendar|time/, CalendarLtr20Regular],
  [/partner|relationship/, Handshake20Regular],
  [/secur|complian|risk|govern/, Shield20Regular],
  [/sales|order|selling/, Money20Regular],
  [/asset|propert|dispos/, Building20Regular],
  [/analy|performance|measure|monitor|report|insight/, DataTrending20Regular],
  [/strateg|polic|define|plan|forecast/, Target20Regular],
  [/data|integrat|system|cloud|implement|administ|licens|job|notification|release/, Settings20Regular],
];

export function endToEndIcon(code: string): FluentIcon {
  return END_TO_END[(code || "").slice(0, 2)] || Target20Regular;
}

export function areaIcon(name: string, endToEndCode: string): FluentIcon {
  const n = (name || "").toLowerCase();
  return AREA_RULES.find(([re]) => re.test(n))?.[1] || endToEndIcon(endToEndCode);
}

/** An icon on a tinted rounded tile in the given colour. */
export function Tile({ icon: I, colour, size = 32, filled }: { icon: FluentIcon; colour: string; size?: number; filled?: boolean }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size / 4, flexShrink: 0, display: "inline-grid", placeItems: "center",
      background: filled ? colour : colour + "1F", color: filled ? "#fff" : colour, boxShadow: filled ? "0 2px 6px " + colour + "55" : undefined }}>
      <I style={{ fontSize: Math.round(size * 0.6) }} />
    </span>
  );
}
