import { Badge } from "@/components/ui/badge";

export function WorkoutBadge({ type, className = "" }: { type: string; className?: string }) {
  const getBadgeProps = () => {
    switch (type.toLowerCase()) {
      case "bodybuilding":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20";
      case "amrap":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20";
      case "emom":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20";
      case "rft":
        return "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20";
      case "cardio":
        return "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20 hover:bg-gray-500/20";
    }
  };

  return (
    <Badge variant="outline" className={`font-mono text-[10px] font-bold uppercase tracking-wider ${getBadgeProps()} ${className}`}>
      {type}
    </Badge>
  );
}
