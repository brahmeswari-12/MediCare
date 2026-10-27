import {
  Activity, Baby, Bone, Brain, BrainCircuit, Ear, Eye, Flower, HeartPulse, ScanFace, Smile, Stethoscope,
} from "lucide-react";

// Maps the backend Specialization.icon key to a Lucide icon.
const ICONS = {
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  "scan-face": ScanFace,
  smile: Smile,
  baby: Baby,
  brain: Brain,
  bone: Bone,
  flower: Flower,
  ear: Ear,
  eye: Eye,
  "brain-circuit": BrainCircuit,
  activity: Activity,
};

export const ICON_KEYS = Object.keys(ICONS);

export default function SpecialtyIcon({ name, size = 22 }) {
  const Icon = ICONS[name] || Stethoscope;
  return <Icon size={size} aria-hidden="true" />;
}
