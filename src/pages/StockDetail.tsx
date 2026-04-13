import { useNavigate } from "react-router-dom";

const StockDetail = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground font-mono">Stock detail coming soon.</p>
        <button onClick={() => navigate("/")} className="text-primary font-mono text-sm mt-4 underline">
          Return to dashboard
        </button>
      </div>
    </div>
  );
};

export default StockDetail;
