import {
  listRecentPublicNotes,
  openPublicDb,
  searchPublicNotes,
} from "./db.mjs";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "hygnote",
  version: "0.1.1",
};

const TOOLS = [
  {
    name: "list_recent_public_notes",
    description:
      "List recent public HygNote notes. Locked/private notes are never returned.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        days: {
          type: "integer",
          minimum: 1,
          maximum: 365,
          description: "How many recent days to include. Default 7.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum notes to return. Default 20.",
        },
      },
    },
  },
  {
    name: "search_public_notes",
    description:
      "Search public HygNote notes by keyword and/or tag. Locked/private notes are never returned.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: {
          type: "string",
          description: "Keyword to match in note content or tags.",
        },
        tag: {
          type: "string",
          description: "Exact tag name to match.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          description: "Maximum notes to return. Default 20.",
        },
      },
    },
  },
];

let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index = buffer.indexOf("\n");
  while (index >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line) handleLine(line);
    index = buffer.indexOf("\n");
  }
});

function handleLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id === undefined) {
    return;
  }
  Promise.resolve(handleRequest(message)).then((result) => {
    write({ jsonrpc: "2.0", id: message.id, result });
  }).catch((error) => {
    write({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  });
}

function handleRequest(message) {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "HygNote public notes only. Locked notes cannot be queried.",
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      return callTool(message.params ?? {});
    default:
      throw new Error(`Unsupported method: ${message.method}`);
  }
}

function callTool(params) {
  const name = String(params.name ?? "");
  const args = params.arguments ?? {};
  const { db, dbPath } = openPublicDb();
  try {
    let notes;
    if (name === "list_recent_public_notes") {
      notes = listRecentPublicNotes(db, args.days, args.limit);
    } else if (name === "search_public_notes") {
      notes = searchPublicNotes(db, args.query, args.tag, args.limit);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
    const payload = {
      ok: true,
      db: dbPath,
      count: notes.length,
      notes,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  } finally {
    db.close();
  }
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}
