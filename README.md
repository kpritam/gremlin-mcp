# Gremlin MCP Server

[![CI](https://github.com/kpritam/gremlin-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/kpritam/gremlin-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/kpritam/gremlin-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/kpritam/gremlin-mcp/actions/workflows/release.yml)
[![npm version](https://badge.fury.io/js/@kpritam%2Fgremlin-mcp.svg)](https://badge.fury.io/js/@kpritam%2Fgremlin-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

> **Connect AI agents like Claude, Cursor, and Windsurf to your graph databases!**

An MCP (Model Context Protocol) server that enables AI assistants to interact with any Gremlin-compatible graph database through natural language. Query your data, discover schemas, analyze relationships, and manage graph data using simple conversations.

## ✨ What You Can Do

Talk to your graph database naturally:

- 🔍 **"What's the structure of my graph?"** - Automatic schema discovery
- 📊 **"Show me all users over 30 and their connections"** - Complex graph queries
- 🔗 **"Find the shortest path between Alice and Bob"** - Relationship analysis
- 📈 **"Give me graph statistics and metrics"** - Data insights
- 📥 **"Import this GraphSON data"** - Data loading
- 📤 **"Export user data as CSV"** - Data extraction
- 🧠 **Smart enum discovery** - AI learns your data's valid values automatically

## 🛠️ Available Tools

Your AI assistant gets access to these powerful tools:

| Tool                        | Purpose          | What It Does                                                      |
| --------------------------- | ---------------- | ----------------------------------------------------------------- |
| 🔍 **get_graph_status**     | Health Check     | Verify database connectivity and server status                    |
| 📋 **get_graph_schema**     | Schema Discovery | Get complete graph structure with nodes, edges, and relationships |
| ⚡ **run_gremlin_query**    | Query Execution  | Execute any Gremlin traversal query with full syntax support      |
| 🔄 **refresh_schema_cache** | Cache Management | Force immediate refresh of cached schema information              |
| 📥 **import_graph_data**    | Data Import      | Load data from GraphSON, CSV, or JSON with batch processing       |
| 📤 **export_subgraph**      | Data Export      | Extract subgraphs to JSON, GraphSON, or CSV formats               |

## 🚀 Quick Setup

### Step 1: Install

```bash
# The npx command will automatically install the package if needed
# No separate installation step required
```

#### Alternative: Build from Source

```bash
# Clone and setup
git clone https://github.com/kpritam/gremlin-mcp.git
cd gremlin-mcp
npm install
npm run build
```

### Step 2: Configure Your AI Client

Add this to your MCP client configuration:

#### Claude Desktop / Cursor / Windsurf

**Using the published package (recommended):**

```json
{
  "mcpServers": {
    "gremlin": {
      "command": "npx",
      "args": ["@kpritam/gremlin-mcp"],
      "env": {
        "GREMLIN_ENDPOINT": "localhost:8182",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**From source:**

```json
{
  "mcpServers": {
    "gremlin": {
      "command": "node",
      "args": ["/path/to/gremlin-mcp/dist/server.js"],
      "env": {
        "GREMLIN_ENDPOINT": "localhost:8182",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

#### With Authentication

```json
{
  "mcpServers": {
    "gremlin": {
      "command": "npx",
      "args": ["@kpritam/gremlin-mcp"],
      "env": {
        "GREMLIN_ENDPOINT": "your-server.com:8182",
        "GREMLIN_USERNAME": "your-username",
        "GREMLIN_PASSWORD": "your-password",
        "GREMLIN_USE_SSL": "true"
      }
    }
  }
}
```

### Step 3: Start Your Gremlin Server

Make sure your Gremlin-compatible database is running:

```bash
# For Apache TinkerPop Gremlin Server
./bin/gremlin-server.sh start

# Or using Docker
docker run -p 8182:8182 tinkerpop/gremlin-server
```

### Step 4: Test the Connection

Restart your AI client and try asking:

> "Can you check if my graph database is connected and show me its schema?"

## 💡 Usage Examples

### Schema Exploration

**You ask:** _"What's the structure of my graph database?"_

**AI response:** The AI calls `get_graph_schema` and tells you about your node types, edge types, and how they're connected.

### Data Analysis

**You ask:** _"Show me all people over 30 and their relationships"_

**AI response:** The AI executes `g.V().hasLabel('person').has('age', gt(30)).out().path()` and explains the results in natural language.

### Graph Metrics

**You ask:** _"Give me some statistics about my graph"_

**AI response:** The AI runs multiple queries to count nodes, edges, and analyze the distribution, then presents a summary.

### Data Import

**You ask:** _"Load this GraphSON data into my database"_

**AI response:** The AI uses `import_graph_data` to process your data in batches and reports the import status.

## 🧠 Automatic Enum Discovery

> **Why this matters:** AI agents work best when they know the exact valid values for properties. Instead of guessing or making invalid queries, they can use precise, real values from your data.

One of the most powerful features of this MCP server is **Automatic Enum Discovery** - it intelligently analyzes your graph data to discover valid property values and provides them as enums to AI agents.

### 🤔 The Problem It Solves

**Without Enum Discovery:**

```
AI: "I see this vertex has a 'status' property of type 'string'...
     Let me try querying with status='active'"
Result: ❌ No results (actual values are 'CONFIRMED', 'PENDING', 'CANCELLED')
```

**With Enum Discovery:**

```
AI: "I can see the 'status' property has these exact values:
     ['CONFIRMED', 'PENDING', 'CANCELLED', 'WAITLISTED']
     Let me query with status='CONFIRMED'"
Result: ✅ Perfect results using real data values
```

### 💡 How It Works

The server automatically scans your graph properties and:

1. **Identifies Low-Cardinality Properties** - Properties with a reasonable number of distinct values
2. **Extracts Real Values** - Samples actual data from your graph
3. **Provides as Enums** - Includes valid values in the schema for AI agents

**Example Output:**

```json
{
  "name": "bookingStatus",
  "type": ["string"],
  "cardinality": "single",
  "enum": ["CONFIRMED", "PENDING", "CANCELLED", "WAITLISTED"],
  "sample_values": ["CONFIRMED", "PENDING"]
}
```

### 🎯 Benefits for AI Agents

- **🎯 Accurate Queries** - AI uses real values instead of guessing
- **⚡ Faster Results** - No trial-and-error with invalid values
- **🧠 Better Understanding** - AI learns your data vocabulary
- **📊 Smarter Analytics** - Enables grouping and filtering with actual categories

### ⚙️ Configuration Options

Fine-tune enum discovery to match your data:

```bash
# Enable/disable enum discovery
GREMLIN_ENUM_DISCOVERY_ENABLED="true"         # Default: true

# Control what gets detected as enum
GREMLIN_ENUM_CARDINALITY_THRESHOLD="10"       # Max distinct values for enum (default: 10)

# Exclude specific properties
GREMLIN_ENUM_PROPERTY_BLACKLIST="id,uuid,timestamp,createdAt,updatedAt"

# Schema optimization
GREMLIN_SCHEMA_MAX_ENUM_VALUES="10"           # Limit enum values shown (default: 10)
GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES="false"  # Reduce schema size (default: false)
```

### 🚫 Property Blacklist

Some properties should never be treated as enums:

**Automatically Excluded:**

- **High-cardinality** properties (> threshold unique values)
- **Numeric IDs** and **UUIDs**
- **Timestamps** and **dates**
- **Long text** fields

**Manual Exclusion:**

```bash
# Exclude specific properties by name
GREMLIN_ENUM_PROPERTY_BLACKLIST="userId,sessionId,description,notes,content"
```

**Common Blacklist Patterns:**

- `id,uuid,guid` - Unique identifiers
- `timestamp,createdAt,updatedAt,lastModified` - Time fields
- `description,notes,comment,content,text` - Free text fields
- `email,url,phone,address` - Personal/contact data
- `hash,token,key,secret` - Security-related fields

### 🛠️ Real-World Examples

**E-commerce Graph:**

```json
{
  "orderStatus": {
    "enum": ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]
  },
  "productCategory": {
    "enum": ["ELECTRONICS", "CLOTHING", "BOOKS", "HOME", "SPORTS"]
  },
  "paymentMethod": {
    "enum": ["CREDIT_CARD", "PAYPAL", "BANK_TRANSFER", "CRYPTO"]
  }
}
```

**Social Network Graph:**

```json
{
  "relationshipType": {
    "enum": ["FRIEND", "FAMILY", "COLLEAGUE", "ACQUAINTANCE"]
  },
  "privacyLevel": {
    "enum": ["PUBLIC", "FRIENDS", "PRIVATE"]
  },
  "accountStatus": {
    "enum": ["ACTIVE", "SUSPENDED", "DEACTIVATED"]
  }
}
```

### 🔧 Tuning for Your Data

**For Large Datasets:**

```bash
GREMLIN_ENUM_CARDINALITY_THRESHOLD="5"     # Stricter enum detection
GREMLIN_SCHEMA_MAX_ENUM_VALUES="5"         # Fewer values in schema
```

**For Rich Categorical Data:**

```bash
GREMLIN_ENUM_CARDINALITY_THRESHOLD="25"    # More permissive detection
GREMLIN_SCHEMA_MAX_ENUM_VALUES="20"        # Show more enum values
```

**For Performance-Critical Environments:**

```bash
GREMLIN_ENUM_DISCOVERY_ENABLED="false"     # Disable for faster schema loading
GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES="false" # Minimal schema size
```

This intelligent enum discovery transforms how AI agents interact with your graph data, making queries more accurate and insights more meaningful! 🎯

## 🗄️ Supported Databases

Works with any Gremlin-compatible graph database:

| Database                | Status        | Notes                            |
| ----------------------- | ------------- | -------------------------------- |
| 🟢 **Apache TinkerPop** | ✅ Tested     | Local development and CI testing |
| 🟡 **Amazon Neptune**   | 🔧 Compatible | Designed for, not yet tested     |
| 🟡 **JanusGraph**       | 🔧 Compatible | Designed for, not yet tested     |
| 🟡 **Azure Cosmos DB**  | 🔧 Compatible | With Gremlin API                 |
| 🟡 **ArcadeDB**         | 🔧 Compatible | With Gremlin support             |

## ⚙️ Configuration Options

### Basic Configuration

```bash
# Required
GREMLIN_ENDPOINT="localhost:8182"

# Optional
GREMLIN_USE_SSL="true"              # Enable SSL/TLS
GREMLIN_USERNAME="username"         # Authentication
GREMLIN_PASSWORD="password"         # Authentication
GREMLIN_IDLE_TIMEOUT="300"          # Connection timeout (seconds)
LOG_LEVEL="info"                    # Logging level
```

### Advanced Configuration

```bash
# Schema and performance tuning (see Automatic Enum Discovery section for details)
GREMLIN_ENUM_DISCOVERY_ENABLED="true"         # Enable smart enum detection
GREMLIN_ENUM_CARDINALITY_THRESHOLD="10"       # Max distinct values for enum
GREMLIN_ENUM_PROPERTY_BLACKLIST="id,timestamp" # Exclude specific properties
GREMLIN_SCHEMA_INCLUDE_SAMPLE_VALUES="false"  # Reduce schema size
GREMLIN_SCHEMA_MAX_ENUM_VALUES="10"           # Limit enum values shown
```

## 🔐 Security Considerations

> **⚠️ Important:** This server is designed for development and trusted environments.

### Current Limitations

- Basic input sanitization (advanced injection protection in development)
- No connection pooling or rate limiting
- All Gremlin syntax is permitted
- No audit logging for security monitoring

### Recommended Security Practices

- 🔒 Use behind a firewall in production
- 🔑 Enable strong authentication on your Gremlin server
- 📊 Monitor query patterns and resource usage
- 🛡️ Consider a query proxy for additional security controls
- 🔄 Keep dependencies updated

## 🆘 Troubleshooting

### Connection Issues

| Problem                 | Solution                                                        |
| ----------------------- | --------------------------------------------------------------- |
| "Connection refused"    | Verify Gremlin server is running: `curl http://localhost:8182/` |
| "Authentication failed" | Check `GREMLIN_USERNAME` and `GREMLIN_PASSWORD`                 |
| "Invalid endpoint"      | Use format `host:port` or `host:port/g` for traversal source    |

### Common Error Messages

- **"Schema cache failed"** - Server couldn't discover graph structure (empty database?)
- **"Invalid query syntax"** - Gremlin query has syntax errors
- **"Timeout"** - Query took too long, check `GREMLIN_IDLE_TIMEOUT`

### Testing Your Setup

```bash
# Test connection
curl -f http://localhost:8182/

# Check server logs
tail -f logs/gremlin-mcp.log

# Verify schema endpoint
curl http://localhost:8182/gremlin
```

---

## 🔧 Developer Documentation

_The following sections are for developers who want to contribute to or modify the server._

### Development Setup

```bash
# Clone and install
git clone https://github.com/kpritam/gremlin-mcp.git
cd gremlin-mcp
npm install

# Development with hot reload
npm run dev

# Run tests
npm test
npm run test:coverage
npm run test:watch

# Integration tests (requires running Gremlin server)
GREMLIN_ENDPOINT=localhost:8182/g npm run test:it

# All tests together (unit + integration)
npm test && npm run test:it
```

### Project Structure

```
src/
├── server.ts              # Main MCP server
├── config.ts              # Environment configuration
├── gremlin/
│   ├── client.ts          # Gremlin database client
│   └── models.ts          # TypeScript types and schemas
├── handlers/
│   ├── tools.ts           # MCP tool implementations
│   └── resources.ts       # MCP resource handlers
└── utils/                 # Utility functions
```

### Available Scripts

| Command            | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `npm run build`    | Compile TypeScript to JavaScript                |
| `npm run dev`      | Development mode with hot reload                |
| `npm test`         | Run unit test suite                             |
| `npm run lint`     | Code linting with ESLint                        |
| `npm run format`   | Code formatting with Prettier                   |
| `npm run validate` | Run all checks (format, lint, type-check, test) |

### Architecture

- **Full Type Safety**: TypeScript + Zod runtime validation
- **MCP SDK**: Official Model Context Protocol implementation
- **Modular Design**: Separated concerns for tools, resources, and utilities
- **Comprehensive Testing**: Unit + Integration
- **Error Handling**: Detailed error messages and graceful degradation

### Smart Schema Discovery

The server implements intelligent schema discovery with enumeration detection:

```typescript
// Property with detected enum values
{
  "name": "status",
  "type": ["string"],
  "cardinality": "single",
  "enum": ["Confirmed", "Pending", "Cancelled", "Waitlisted"]
}
```

### Contributing

1. Follow the rules in `RULES.md`
2. Run `npm run validate` before committing
3. Add tests for new functionality
4. Update documentation for user-facing changes
5. Ensure all tests pass

### Testing Strategy

- **Unit Tests** (`tests/`): Individual component testing
  - Component isolation with comprehensive mocking
  - Type safety validation with Zod schemas
  - Fast execution without external dependencies
- **Integration Tests** (`tests/integration/`): Full workflow testing
  - Real Gremlin server connections via Docker
  - End-to-end MCP protocol validation
  - Database operations and query execution
- **CI Testing**: Automated testing in GitHub Actions
  - Unit tests run on every commit
  - Integration tests run with Docker Gremlin server
  - Both required for releases

## 📄 License

MIT License - feel free to use in your projects!

---

**Questions?** Check the [troubleshooting guide](#🆘-troubleshooting) or [open an issue](https://github.com/kpritam/gremlin-mcp/issues).
