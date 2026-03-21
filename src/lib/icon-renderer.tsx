import * as React from "react"
import * as LucideIcons from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ── Whitelist ─────────────────────────────────────────────────────────────────
// Kept in sync with ThinkEx src/lib/workspace-icons.ts

const WORKSPACE_ICON_NAMES = [
  "Archive", "File", "FileAudio", "FileCheck", "FileCode", "FileImage",
  "FileKey", "FileSearch", "FileSpreadsheet", "FileText", "FileVideo",
  "Folder", "FolderOpen", "FolderPlus", "Inbox", "Search", "Calculator",
  "BarChart2", "ChartBarBig", "ChartLine", "Gauge", "PieChart", "Scale",
  "Table", "Atom", "Beaker", "Bug", "Dna", "Droplets", "FlaskConical",
  "Leaf", "LeafyGreen", "Microscope", "Mountain", "Pipette", "Satellite",
  "Sprout", "Telescope", "TestTube", "TestTubes", "Flame", "Wheat", "Zap",
  "Heart", "HeartPulse", "Hospital", "Pill", "PillBottle", "Stethoscope",
  "Syringe", "Book", "BookOpen", "BookOpenCheck", "BookOpenText", "BookText",
  "Bookmark", "BookmarkCheck", "Church", "Gavel", "Landmark", "Languages",
  "Map", "MapPin", "Newspaper", "Pickaxe", "ScrollText", "Camera", "Eye",
  "Film", "Headphones", "Image", "Music", "Mic", "PaintBucket", "Paintbrush",
  "Palette", "Shapes", "Utensils", "Video", "Backpack", "Brain",
  "GraduationCap", "Lectern", "Library", "LibraryBig", "LifeBuoy",
  "Lightbulb", "Notebook", "NotebookText", "NotepadText", "School",
  "University", "Bot", "Code", "Code2", "Cpu", "Database", "DraftingCompass",
  "GitBranch", "GitCommit", "Microchip", "Monitor", "Ruler", "Server",
  "Terminal", "Banknote", "Briefcase", "BriefcaseMedical", "Building",
  "Building2", "Factory", "Globe", "Store", "Wallet", "Warehouse", "Anchor",
  "Dumbbell", "Fish", "PawPrint", "Fuel", "Recycle", "Ship", "Waves", "Home",
  "Box", "Calendar", "CalendarDays", "Clipboard", "ClipboardCheck",
  "ClipboardList", "Copy", "Clock", "Cloud", "Fingerprint", "Flag", "Gift",
  "Key", "Kanban", "LandPlot", "Link", "Mail", "MessageCircle", "Megaphone",
  "Package", "Paperclip", "Pencil", "Presentation", "Printer", "Puzzle",
  "Rocket", "Rss", "Settings", "Share2", "ShieldCheck", "Sparkles",
  "SquarePen", "Star", "Tag", "Target", "Ticket", "Trophy", "User", "Users",
  "Workflow", "Wrench",
] as const

const WHITELIST_SET = new Set<string>(WORKSPACE_ICON_NAMES)

// ── Legacy Heroicon → Lucide map ──────────────────────────────────────────────
// Kept in sync with ThinkEx src/hooks/use-icon-picker.tsx

const HEROICON_TO_LUCIDE: Record<string, string> = {
  AcademicCapIcon: "GraduationCap",
  ArchiveBoxIcon: "Archive",
  BanknotesIcon: "Banknote",
  BeakerIcon: "FlaskConical",
  BoltIcon: "Zap",
  BookOpenIcon: "BookOpen",
  BookmarkIcon: "Bookmark",
  BookmarkSquareIcon: "Bookmark",
  BriefcaseIcon: "Briefcase",
  BugAntIcon: "Bug",
  BuildingLibraryIcon: "Library",
  BuildingOffice2Icon: "Building2",
  BuildingOfficeIcon: "Building",
  BuildingStorefrontIcon: "Store",
  CalculatorIcon: "Calculator",
  CalendarIcon: "Calendar",
  CalendarDaysIcon: "CalendarDays",
  CameraIcon: "Camera",
  ChartBarIcon: "BarChart2",
  ChartBarSquareIcon: "BarChart2",
  ChartPieIcon: "PieChart",
  ChatBubbleLeftIcon: "MessageCircle",
  ClipboardDocumentIcon: "ClipboardList",
  ClipboardDocumentCheckIcon: "ClipboardCheck",
  ClockIcon: "Clock",
  CogIcon: "Settings",
  CpuChipIcon: "Cpu",
  CloudIcon: "Cloud",
  CodeBracketIcon: "Code",
  CodeBracketSquareIcon: "Code2",
  CommandLineIcon: "Terminal",
  ComputerDesktopIcon: "Monitor",
  DocumentChartBarIcon: "FileSpreadsheet",
  DocumentDuplicateIcon: "Copy",
  DocumentIcon: "File",
  DocumentTextIcon: "FileText",
  DocumentMagnifyingGlassIcon: "FileSearch",
  EnvelopeIcon: "Mail",
  EyeIcon: "Eye",
  FilmIcon: "Film",
  FingerPrintIcon: "Fingerprint",
  FireIcon: "Flame",
  FlagIcon: "Flag",
  FolderIcon: "Folder",
  FolderOpenIcon: "FolderOpen",
  FolderPlusIcon: "FolderPlus",
  GiftIcon: "Gift",
  GlobeAltIcon: "Globe",
  HeartIcon: "Heart",
  HomeIcon: "Home",
  HomeModernIcon: "Building2",
  InboxIcon: "Inbox",
  InboxStackIcon: "Archive",
  KeyIcon: "Key",
  LanguageIcon: "Languages",
  LifebuoyIcon: "LifeBuoy",
  LightBulbIcon: "Lightbulb",
  LinkIcon: "Link",
  MagnifyingGlassIcon: "Search",
  MapIcon: "Map",
  MapPinIcon: "MapPin",
  MegaphoneIcon: "Megaphone",
  MicrophoneIcon: "Mic",
  MusicalNoteIcon: "Music",
  NewspaperIcon: "Newspaper",
  PaintBrushIcon: "Paintbrush",
  PaperClipIcon: "Paperclip",
  PencilSquareIcon: "SquarePen",
  PhotoIcon: "Image",
  PresentationChartBarIcon: "Presentation",
  PresentationChartLineIcon: "Presentation",
  PrinterIcon: "Printer",
  PuzzlePieceIcon: "Puzzle",
  RocketLaunchIcon: "Rocket",
  RssIcon: "Rss",
  ScaleIcon: "Scale",
  ServerIcon: "Server",
  ServerStackIcon: "Server",
  ShareIcon: "Share2",
  ShieldCheckIcon: "ShieldCheck",
  SparklesIcon: "Sparkles",
  StarIcon: "Star",
  SwatchIcon: "Palette",
  TableCellsIcon: "Table",
  TagIcon: "Tag",
  TicketIcon: "Ticket",
  TrophyIcon: "Trophy",
  UserGroupIcon: "Users",
  UserIcon: "User",
  UsersIcon: "Users",
  VideoCameraIcon: "Video",
  WalletIcon: "Wallet",
  WrenchIcon: "Wrench",
}

function getWhitelistedIcon(name: string): LucideIcon | undefined {
  if (!WHITELIST_SET.has(name)) return undefined
  const raw = LucideIcons[name as keyof typeof LucideIcons]
  return raw != null ? (raw as LucideIcon) : undefined
}

// ── IconRenderer ──────────────────────────────────────────────────────────────

export function IconRenderer({
  icon,
  className,
  ...rest
}: { icon: string | null | undefined } & React.ComponentPropsWithoutRef<"svg">) {
  const DefaultIcon = LucideIcons.Folder

  if (!icon) {
    return <DefaultIcon className={className} {...rest} />
  }

  let iconName: string
  if (icon.includes(":")) {
    const [, name] = icon.split(":")
    iconName = name ?? icon
  } else {
    iconName = HEROICON_TO_LUCIDE[icon] ?? icon
  }

  const IconComponent = getWhitelistedIcon(iconName)
  if (!IconComponent) {
    return <DefaultIcon className={className} {...rest} />
  }

  return <IconComponent className={className} {...rest} />
}
