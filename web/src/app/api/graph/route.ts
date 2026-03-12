import { NextResponse } from "next/server";
import { getGraphData } from "@/lib/db/graph-queries";

export async function GET() {
    try {
          const data = await getGraphData();
          return NextResponse.json(data);
    } catch (error) {
          console.error("Graph API error:", error);
          return NextResponse.json(
            { error: "Failed to fetch graph data" },
            { status: 500 }
                );
    }
}
