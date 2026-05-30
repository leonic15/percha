import { LookLoopSpinner } from "@/components/ui";

export default function GuardarropaLoading() {
  return (
    <div className="min-h-dvh bg-bg flex items-center justify-center">
      <LookLoopSpinner size={72} />
    </div>
  );
}
