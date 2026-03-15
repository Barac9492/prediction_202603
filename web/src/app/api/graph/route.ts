import { NextResponse } from "next/server";
import { getGraphData } from "@/lib/db/graph-queries";
import { getWorkspaceId } from "@/lib/db/workspace";

export async function GET() {
    try {
          const workspaceId = await getWorkspaceId();
          const data = await getGraphData(workspaceId);
          return NextResponse.json(data);
    } catch (error) {
          console.error("Graph API error:", error);
          return NextResponse.json(
            { error: "Failed to fetch graph data" },
            { status: 500 }
                );
    }
}
