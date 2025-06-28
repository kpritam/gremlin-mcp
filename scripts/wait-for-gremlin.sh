#!/bin/bash

# wait-for-gremlin.sh - Wait for Gremlin server to be ready
# Usage: ./scripts/wait-for-gremlin.sh [host] [port] [timeout_seconds]

set -e

HOST=${1:-localhost}
PORT=${2:-8182}
TIMEOUT=${3:-60}
ATTEMPTS=$((TIMEOUT / 5))

echo "🔍 Waiting for Gremlin server at $HOST:$PORT (timeout: ${TIMEOUT}s)..."

# Check container status first
echo "📋 Container status:"
docker ps

# Wait for server to be ready
for i in $(seq 1 $ATTEMPTS); do
  echo "🔄 Attempt $i/$ATTEMPTS: Testing connection..."
  
  # Test port connectivity
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo "✅ Port $PORT is accessible"
    
    # Test HTTP response (accept any valid response)
    response=$(curl --max-time 5 --write-out "%{http_code}" --silent --output /dev/null "http://$HOST:$PORT/" 2>/dev/null || echo "000")
    echo "📡 HTTP response: $response"
    
    if [ "$response" != "000" ] && [ "$response" != "curl_failed" ]; then
      echo "🎉 Gremlin server is ready! (HTTP $response)"
      
      # Quick endpoint verification
      echo "🔍 Testing Gremlin endpoint..."
      curl --max-time 3 --silent "http://$HOST:$PORT/gremlin" >/dev/null 2>&1 && echo "✅ /gremlin endpoint accessible" || echo "ℹ️  /gremlin endpoint test completed"
      
      exit 0
    fi
  else
    echo "⏳ Port $PORT not yet accessible"
  fi
  
  echo "⏸️  Waiting 5 seconds..."
  sleep 5
done

# Failure diagnostics
echo "❌ Server failed to start after ${TIMEOUT} seconds"
echo "🔍 Final diagnostics:"
echo "📋 All containers:"
docker ps -a
echo "📄 Container logs:"
docker logs $(docker ps -q --filter ancestor=tinkerpop/gremlin-server:3.7.3) --tail 50 2>/dev/null || echo "No container logs available"
echo "🌐 Network test:"
nc -zv "$HOST" "$PORT" 2>&1 || echo "Port $PORT is not accessible"

exit 1