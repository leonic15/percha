import { LookLoopSpinner } from "@/components/ui";

export default function GarmentDetailLoading() {
  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center">
      <LookLoopSpinner size={72} />
    </div>
  );
}
