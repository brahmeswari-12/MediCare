import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { EmptyState } from "../../components/ui";

export default function NotFound() {
  return (
    <div className="container" style={{ paddingTop: 64 }}>
      <EmptyState
        icon={Search}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={<Link to="/" className="btn btn-primary">Go to the homepage</Link>}
      />
    </div>
  );
}
