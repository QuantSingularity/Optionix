#!/bin/bash
# Performance Monitoring Script for Optionix
# This script automates performance monitoring, benchmarking, and reporting

set -e  # Exit immediately if a command exits with a non-zero status

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
REPORT_DIR="./performance_reports"
DURATION=60  # seconds
INTERVAL=5   # seconds
API_ENDPOINT="http://localhost:8000"
LOAD_TEST_USERS=10
LOAD_TEST_DURATION=30  # seconds

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to display section headers
section_header() {
  echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Function to display step information
step_info() {
  echo -e "${BLUE}$1${NC}"
}

# Function to display success messages
step_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to display error messages
step_error() {
  echo -e "${RED}✗ $1${NC}"
  if [ "$2" = "exit" ]; then
    exit 1
  fi
}

# Parse command line arguments
parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --report-dir=*)
        REPORT_DIR="${1#*=}"
        shift
        ;;
      --duration=*)
        DURATION="${1#*=}"
        shift
        ;;
      --interval=*)
        INTERVAL="${1#*=}"
        shift
        ;;
      --api-endpoint=*)
        API_ENDPOINT="${1#*=}"
        shift
        ;;
      --load-test-users=*)
        LOAD_TEST_USERS="${1#*=}"
        shift
        ;;
      --load-test-duration=*)
        LOAD_TEST_DURATION="${1#*=}"
        shift
        ;;
      --help)
        echo "Usage: $0 [command] [options]"
        echo
        echo "Commands:"
        echo "  monitor     Monitor system performance"
        echo "  benchmark   Run API benchmarks"
        echo "  loadtest    Run load tests"
        echo "  report      Generate performance report"
        echo
        echo "Options:"
        echo "  --report-dir=DIR           Directory for reports (default: ./performance_reports)"
        echo "  --duration=SECONDS         Duration of monitoring (default: 60)"
        echo "  --interval=SECONDS         Interval between measurements (default: 5)"
        echo "  --api-endpoint=URL         API endpoint for testing (default: http://localhost:8000)"
        echo "  --load-test-users=NUM      Number of concurrent users for load testing (default: 10)"
        echo "  --load-test-duration=SEC   Duration of load test in seconds (default: 30)"
        echo "  --help                     Show this help message"
        exit 0
        ;;
      monitor|benchmark|loadtest|report)
        COMMAND=$1
        shift
        ;;
      *)
        step_error "Unknown option or command: $1" "exit"
        ;;
    esac
  done

  if [ -z "$COMMAND" ]; then
    step_error "No command specified. Use --help for usage information." "exit"
  fi
}

# Check requirements
check_requirements() {
  section_header "Checking Requirements"

  # Create report directory if it doesn't exist
  if [ ! -d "$REPORT_DIR" ]; then
    mkdir -p "$REPORT_DIR"
    step_success "Created report directory: $REPORT_DIR"
  else
    step_success "Report directory exists: $REPORT_DIR"
  fi

  # Check required tools based on command
  case $COMMAND in
    monitor)
      for tool in top ps free df; do
        if command_exists $tool; then
          step_success "$tool is installed"
        else
          step_error "$tool is required but not installed" "exit"
        fi
      done
      ;;
    benchmark|loadtest)
      if command_exists curl; then
        step_success "curl is installed"
      else
        step_error "curl is required but not installed" "exit"
      fi

      if command_exists ab; then
        step_success "Apache Bench (ab) is installed"
      else
        step_error "Apache Bench (ab) is not installed"
        step_info "Installing Apache Bench..."
        if command_exists apt-get; then
          sudo apt-get update && sudo apt-get install -y apache2-utils
          step_success "Apache Bench installed"
        elif command_exists brew; then
          brew install apache2-utils
          step_success "Apache Bench installed"
        else
          step_error "Could not install Apache Bench. Please install manually." "exit"
        fi
      fi
      ;;
    report)
      if command_exists gnuplot; then
        step_success "gnuplot is installed"
      else
        step_error "gnuplot is not installed"
        step_info "Installing gnuplot..."
        if command_exists apt-get; then
          sudo apt-get update && sudo apt-get install -y gnuplot
          step_success "gnuplot installed"
        elif command_exists brew; then
          brew install gnuplot
          step_success "gnuplot installed"
        else
          step_error "Could not install gnuplot. Please install manually."
          step_info "Continuing without visualization capabilities"
        fi
      fi
      ;;
  esac
}

# Monitor system performance
monitor_performance() {
  section_header "Monitoring System Performance"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  CPU_LOG="$REPORT_DIR/cpu_${TIMESTAMP}.log"
  MEMORY_LOG="$REPORT_DIR/memory_${TIMESTAMP}.log"
  DISK_LOG="$REPORT_DIR/disk_${TIMESTAMP}.log"

  step_info "Monitoring system for $DURATION seconds with $INTERVAL second intervals"
  step_info "Logs will be saved to $REPORT_DIR"

  # Initialize log files with headers
  echo "Timestamp,CPU_User,CPU_System,CPU_Idle,CPU_IOWait" > "$CPU_LOG"
  echo "Timestamp,Total_Memory,Used_Memory,Free_Memory,Cached_Memory,Buffer_Memory" > "$MEMORY_LOG"
  echo "Timestamp,Disk_Read_Ops,Disk_Write_Ops,Disk_Read_KB,Disk_Write_KB" > "$DISK_LOG"

  # Start monitoring
  END_TIME=$(($(date +%s) + DURATION))

  while [ "$(date +%s)" -lt "$END_TIME" ]; do
    CURRENT_TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

    # CPU usage. Extract via label-anchored regex rather than positional
    # awk fields: `top` right-justifies these fixed-width percentage
    # columns, and when a value reaches 3 integer digits (e.g. idle=100.0)
    # the padding can swallow the separating space before it, which
    # silently shifts every subsequent awk field index and previously
    # produced garbage (e.g. capturing the literal label "id," instead of
    # a number) roughly half the time on an idle system. Also sample `top`
    # once instead of four separate times, since each independent
    # invocation captures a different instant.
    CPU_LINE=$(top -bn1 | grep "Cpu(s)")
    CPU_USER=$(echo "$CPU_LINE" | grep -oP '[\d.]+(?=\s*us,)')
    CPU_SYSTEM=$(echo "$CPU_LINE" | grep -oP '[\d.]+(?=\s*sy,)')
    CPU_IDLE=$(echo "$CPU_LINE" | grep -oP '[\d.]+(?=\s*id,)')
    CPU_IOWAIT=$(echo "$CPU_LINE" | grep -oP '[\d.]+(?=\s*wa,)')
    CPU_STATS=$(echo "100 - $CPU_IDLE" | bc 2>/dev/null || awk -v idle="$CPU_IDLE" 'BEGIN{print 100-idle}')
    echo "$CURRENT_TIMESTAMP,$CPU_USER,$CPU_SYSTEM,$CPU_IDLE,$CPU_IOWAIT" >> "$CPU_LOG"

    # Memory usage
    TOTAL_MEM=$(free -m | grep Mem | awk '{print $2}')
    USED_MEM=$(free -m | grep Mem | awk '{print $3}')
    FREE_MEM=$(free -m | grep Mem | awk '{print $4}')
    CACHED_MEM=$(free -m | grep Mem | awk '{print $6}')
    BUFFER_MEM=$(free -m | grep Mem | awk '{print $5}')
    echo "$CURRENT_TIMESTAMP,$TOTAL_MEM,$USED_MEM,$FREE_MEM,$CACHED_MEM,$BUFFER_MEM" >> "$MEMORY_LOG"

    # Disk I/O
    if [ -f "/proc/diskstats" ]; then
      DISK_STATS=$(cat /proc/diskstats | grep -w "sda" || echo "0 0 0 0 0 0 0 0 0 0 0")
      DISK_READ_OPS=$(echo "$DISK_STATS" | awk '{print $4}')
      DISK_WRITE_OPS=$(echo "$DISK_STATS" | awk '{print $8}')
      DISK_READ_KB=$(echo "$DISK_STATS" | awk '{print $6/2}')
      DISK_WRITE_KB=$(echo "$DISK_STATS" | awk '{print $10/2}')
      echo "$CURRENT_TIMESTAMP,$DISK_READ_OPS,$DISK_WRITE_OPS,$DISK_READ_KB,$DISK_WRITE_KB" >> "$DISK_LOG"
    else
      echo "$CURRENT_TIMESTAMP,0,0,0,0" >> "$DISK_LOG"
    fi

    # Display current stats
    echo -ne "CPU Usage: ${CPU_STATS}% | Memory Used: ${USED_MEM}/${TOTAL_MEM} MB | Time left: $((END_TIME - $(date +%s))) seconds\r"

    sleep $INTERVAL
  done

  echo
  step_success "Monitoring completed"
  step_info "CPU log: $CPU_LOG"
  step_info "Memory log: $MEMORY_LOG"
  step_info "Disk log: $DISK_LOG"
}

# Run API benchmarks
run_benchmarks() {
  section_header "Running API Benchmarks"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BENCHMARK_LOG="$REPORT_DIR/benchmark_${TIMESTAMP}.log"

  step_info "Running benchmarks against $API_ENDPOINT"
  step_info "Results will be saved to $BENCHMARK_LOG"

  # Initialize log file with header
  echo "Endpoint,Requests,Concurrency,Time_Taken,Requests_per_second,Time_per_request,Transfer_rate" > "$BENCHMARK_LOG"

  # Check if API is running
  if ! curl -s "$API_ENDPOINT" > /dev/null; then
    step_error "API endpoint $API_ENDPOINT is not responding. Please ensure the API is running."
    return 1
  fi

  # Define benchmark scenarios. These must be real, unauthenticated, GET
  # endpoints that actually exist on the backend — most Optionix routes
  # (trading/portfolio/analytics/risk/compliance) require a Bearer token and
  # aren't suitable for a plain `ab` GET benchmark.
  declare -A ENDPOINTS
  ENDPOINTS=(
    ["root"]="/"
    ["health"]="/health"
    ["docs"]="/docs"
    ["openapi"]="/openapi.json"
  )

  # Run benchmarks for each endpoint
  for endpoint_name in "${!ENDPOINTS[@]}"; do
    endpoint_path=${ENDPOINTS[$endpoint_name]}
    full_url="${API_ENDPOINT}${endpoint_path}"

    step_info "Benchmarking endpoint: $endpoint_name ($full_url)"

    # Run Apache Bench
    AB_OUTPUT=$(ab -n 1000 -c 10 -k "$full_url" 2>&1)

    # Extract metrics
    REQUESTS=$(echo "$AB_OUTPUT" | grep "Complete requests:" | awk '{print $3}')
    CONCURRENCY=$(echo "$AB_OUTPUT" | grep "Concurrency Level:" | awk '{print $3}')
    TIME_TAKEN=$(echo "$AB_OUTPUT" | grep "Time taken for tests:" | awk '{print $5}')
    RPS=$(echo "$AB_OUTPUT" | grep "Requests per second:" | awk '{print $4}')
    TIME_PER_REQUEST=$(echo "$AB_OUTPUT" | grep -A 1 "Time per request:" | tail -n 1 | awk '{print $4}')
    TRANSFER_RATE=$(echo "$AB_OUTPUT" | grep "Transfer rate:" | awk '{print $3}')

    # Log results
    echo "$endpoint_name,$REQUESTS,$CONCURRENCY,$TIME_TAKEN,$RPS,$TIME_PER_REQUEST,$TRANSFER_RATE" >> "$BENCHMARK_LOG"

    # Display results
    echo "  Requests: $REQUESTS"
    echo "  Concurrency: $CONCURRENCY"
    echo "  Time taken: $TIME_TAKEN seconds"
    echo "  Requests per second: $RPS"
    echo "  Time per request: $TIME_PER_REQUEST ms"
    echo "  Transfer rate: $TRANSFER_RATE KB/s"
    echo
  done

  step_success "Benchmarking completed"
  step_info "Benchmark log: $BENCHMARK_LOG"
}

# Run load tests
run_load_tests() {
  section_header "Running Load Tests"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  LOADTEST_LOG="$REPORT_DIR/loadtest_${TIMESTAMP}.log"

  step_info "Running load tests against $API_ENDPOINT with $LOAD_TEST_USERS concurrent users for $LOAD_TEST_DURATION seconds"
  step_info "Results will be saved to $LOADTEST_LOG"

  # Initialize log file with header
  echo "Endpoint,Requests,Failed,RPS,Min_Latency,Mean_Latency,Max_Latency,50th_Percentile,90th_Percentile,99th_Percentile" > "$LOADTEST_LOG"

  # Check if API is running
  if ! curl -s "$API_ENDPOINT" > /dev/null; then
    step_error "API endpoint $API_ENDPOINT is not responding. Please ensure the API is running."
    return 1
  fi

  # Define load test scenarios (same real, unauthenticated endpoints as the
  # benchmark scenarios above)
  declare -A ENDPOINTS
  ENDPOINTS=(
    ["root"]="/"
    ["health"]="/health"
    ["docs"]="/docs"
    ["openapi"]="/openapi.json"
  )

  # Run load tests for each endpoint
  for endpoint_name in "${!ENDPOINTS[@]}"; do
    endpoint_path=${ENDPOINTS[$endpoint_name]}
    full_url="${API_ENDPOINT}${endpoint_path}"

    step_info "Load testing endpoint: $endpoint_name ($full_url)"

    # Run Apache Bench with more intensive parameters
    AB_OUTPUT=$(ab -n $((LOAD_TEST_USERS * 100)) -c $LOAD_TEST_USERS -t $LOAD_TEST_DURATION -k "$full_url" 2>&1)

    # Extract metrics
    REQUESTS=$(echo "$AB_OUTPUT" | grep "Complete requests:" | awk '{print $3}')
    FAILED=$(echo "$AB_OUTPUT" | grep "Failed requests:" | awk '{print $3}')
    RPS=$(echo "$AB_OUTPUT" | grep "Requests per second:" | awk '{print $4}')
    # The "min"/"mean"/"max" column header row of ab's "Connection Times"
    # section literally contains the words "min", "mean[+/-sd]" and "max",
    # so a naive `grep "min"` etc. matches that HEADER line instead of the
    # "Total:" data row and extracts garbage (e.g. the literal text
    # "mean[+/-sd]") instead of a number. Extract from the Total: line only.
    AB_TOTAL_LINE=$(echo "$AB_OUTPUT" | grep "^Total:")
    MIN_LATENCY=$(echo "$AB_TOTAL_LINE" | awk '{print $2}')
    MEAN_LATENCY=$(echo "$AB_TOTAL_LINE" | awk '{print $3}')
    MAX_LATENCY=$(echo "$AB_TOTAL_LINE" | awk '{print $6}')
    PERCENTILE_50=$(echo "$AB_OUTPUT" | grep "50%" | awk '{print $2}')
    PERCENTILE_90=$(echo "$AB_OUTPUT" | grep "90%" | awk '{print $2}')
    PERCENTILE_99=$(echo "$AB_OUTPUT" | grep "99%" | awk '{print $2}')

    # Log results
    echo "$endpoint_name,$REQUESTS,$FAILED,$RPS,$MIN_LATENCY,$MEAN_LATENCY,$MAX_LATENCY,$PERCENTILE_50,$PERCENTILE_90,$PERCENTILE_99" >> "$LOADTEST_LOG"

    # Display results
    echo "  Requests: $REQUESTS"
    echo "  Failed: $FAILED"
    echo "  Requests per second: $RPS"
    echo "  Latency (min/mean/max): $MIN_LATENCY/$MEAN_LATENCY/$MAX_LATENCY ms"
    echo "  Percentiles (50/90/99): $PERCENTILE_50/$PERCENTILE_90/$PERCENTILE_99 ms"
    echo
  done

  step_success "Load testing completed"
  step_info "Load test log: $LOADTEST_LOG"
}

# Generate performance report
generate_report() {
  section_header "Generating Performance Report"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  REPORT_FILE="$REPORT_DIR/performance_report_${TIMESTAMP}.html"

  step_info "Generating performance report: $REPORT_FILE"

  # Find latest log files
  CPU_LOG=$(ls -t "$REPORT_DIR"/cpu_*.log 2>/dev/null | head -n 1)
  MEMORY_LOG=$(ls -t "$REPORT_DIR"/memory_*.log 2>/dev/null | head -n 1)
  DISK_LOG=$(ls -t "$REPORT_DIR"/disk_*.log 2>/dev/null | head -n 1)
  BENCHMARK_LOG=$(ls -t "$REPORT_DIR"/benchmark_*.log 2>/dev/null | head -n 1)
  LOADTEST_LOG=$(ls -t "$REPORT_DIR"/loadtest_*.log 2>/dev/null | head -n 1)

  # Check if log files exist
  if [ -z "$CPU_LOG" ] && [ -z "$MEMORY_LOG" ] && [ -z "$BENCHMARK_LOG" ] && [ -z "$LOADTEST_LOG" ]; then
    step_error "No log files found in $REPORT_DIR. Please run monitoring, benchmarking, or load testing first."
    return 1
  fi

  # Generate HTML report
  cat > "$REPORT_FILE" << EOF
<!DOCTYPE html>
<html>
<head>
  <title>Optionix Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    .section { margin: 20px 0; padding: 10px; background-color: #f5f5f5; border-radius: 5px; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .chart { width: 100%; height: 300px; margin: 20px 0; background-color: #eee; border-radius: 5px; text-align: center; line-height: 300px; }
  </style>
</head>
<body>
  <h1>Optionix Performance Report</h1>
  <p><strong>Generated:</strong> $(date)</p>

  <div class="section">
    <h2>Summary</h2>
    <p>This report contains performance metrics for the Optionix application.</p>
  </div>
EOF

  # Add system monitoring section if logs exist
  if [ -n "$CPU_LOG" ] || [ -n "$MEMORY_LOG" ] || [ -n "$DISK_LOG" ]; then
    cat >> "$REPORT_FILE" << EOF
  <div class="section">
    <h2>System Monitoring</h2>

EOF

    if [ -n "$CPU_LOG" ]; then
      cat >> "$REPORT_FILE" << EOF
    <h3>CPU Usage</h3>
    <div class="chart">CPU usage chart would be displayed here</div>
    <table>
      <tr>
        <th>Timestamp</th>
        <th>CPU User (%)</th>
        <th>CPU System (%)</th>
        <th>CPU Idle (%)</th>
        <th>CPU I/O Wait (%)</th>
      </tr>
EOF

      # Add CPU data (limit to 10 rows for readability)
      tail -n 10 "$CPU_LOG" | while IFS=, read -r timestamp cpu_user cpu_system cpu_idle cpu_iowait; do
        if [ "$timestamp" != "Timestamp" ]; then
          echo "      <tr><td>$timestamp</td><td>$cpu_user</td><td>$cpu_system</td><td>$cpu_idle</td><td>$cpu_iowait</td></tr>" >> "$REPORT_FILE"
        fi
      done

      echo "    </table>" >> "$REPORT_FILE"
    fi

    if [ -n "$MEMORY_LOG" ]; then
      cat >> "$REPORT_FILE" << EOF
    <h3>Memory Usage</h3>
    <div class="chart">Memory usage chart would be displayed here</div>
    <table>
      <tr>
        <th>Timestamp</th>
        <th>Total Memory (MB)</th>
        <th>Used Memory (MB)</th>
        <th>Free Memory (MB)</th>
        <th>Cached Memory (MB)</th>
        <th>Buffer Memory (MB)</th>
      </tr>
EOF

      # Add memory data (limit to 10 rows for readability)
      tail -n 10 "$MEMORY_LOG" | while IFS=, read -r timestamp total_mem used_mem free_mem cached_mem buffer_mem; do
        if [ "$timestamp" != "Timestamp" ]; then
          echo "      <tr><td>$timestamp</td><td>$total_mem</td><td>$used_mem</td><td>$free_mem</td><td>$cached_mem</td><td>$buffer_mem</td></tr>" >> "$REPORT_FILE"
        fi
      done

      echo "    </table>" >> "$REPORT_FILE"
    fi

    if [ -n "$DISK_LOG" ]; then
      cat >> "$REPORT_FILE" << EOF
    <h3>Disk I/O</h3>
    <div class="chart">Disk I/O chart would be displayed here</div>
    <table>
      <tr>
        <th>Timestamp</th>
        <th>Disk Read Ops</th>
        <th>Disk Write Ops</th>
        <th>Disk Read (KB)</th>
        <th>Disk Write (KB)</th>
      </tr>
EOF

      # Add disk data (limit to 10 rows for readability)
      tail -n 10 "$DISK_LOG" | while IFS=, read -r timestamp read_ops write_ops read_kb write_kb; do
        if [ "$timestamp" != "Timestamp" ]; then
          echo "      <tr><td>$timestamp</td><td>$read_ops</td><td>$write_ops</td><td>$read_kb</td><td>$write_kb</td></tr>" >> "$REPORT_FILE"
        fi
      done

      echo "    </table>" >> "$REPORT_FILE"
    fi

    echo "  </div>" >> "$REPORT_FILE"
  fi

  # Add benchmark section if log exists
  if [ -n "$BENCHMARK_LOG" ]; then
    cat >> "$REPORT_FILE" << EOF
  <div class="section">
    <h2>API Benchmarks</h2>
    <table>
      <tr>
        <th>Endpoint</th>
        <th>Requests</th>
        <th>Concurrency</th>
        <th>Time Taken (s)</th>
        <th>Requests/sec</th>
        <th>Time/request (ms)</th>
        <th>Transfer Rate (KB/s)</th>
      </tr>
EOF

    # Add benchmark data
    tail -n +2 "$BENCHMARK_LOG" | while IFS=, read -r endpoint requests concurrency time_taken rps time_per_request transfer_rate; do
      echo "      <tr><td>$endpoint</td><td>$requests</td><td>$concurrency</td><td>$time_taken</td><td>$rps</td><td>$time_per_request</td><td>$transfer_rate</td></tr>" >> "$REPORT_FILE"
    done

    echo "    </table>" >> "$REPORT_FILE"
    echo "  </div>" >> "$REPORT_FILE"
  fi

  # Add load test section if log exists
  if [ -n "$LOADTEST_LOG" ]; then
    cat >> "$REPORT_FILE" << EOF
  <div class="section">
    <h2>Load Tests</h2>
    <table>
      <tr>
        <th>Endpoint</th>
        <th>Requests</th>
        <th>Failed</th>
        <th>Requests/sec</th>
        <th>Min Latency (ms)</th>
        <th>Mean Latency (ms)</th>
        <th>Max Latency (ms)</th>
        <th>50th Percentile (ms)</th>
        <th>90th Percentile (ms)</th>
        <th>99th Percentile (ms)</th>
      </tr>
EOF

    # Add load test data
    tail -n +2 "$LOADTEST_LOG" | while IFS=, read -r endpoint requests failed rps min_latency mean_latency max_latency percentile_50 percentile_90 percentile_99; do
      echo "      <tr><td>$endpoint</td><td>$requests</td><td>$failed</td><td>$rps</td><td>$min_latency</td><td>$mean_latency</td><td>$max_latency</td><td>$percentile_50</td><td>$percentile_90</td><td>$percentile_99</td></tr>" >> "$REPORT_FILE"
    done

    echo "    </table>" >> "$REPORT_FILE"
    echo "  </div>" >> "$REPORT_FILE"
  fi

  # Close HTML
  cat >> "$REPORT_FILE" << EOF
  <div class="section">
    <h2>Recommendations</h2>
    <ul>
      <li>Monitor CPU usage during peak loads to ensure adequate resources</li>
      <li>Consider optimizing database queries if response times exceed thresholds</li>
      <li>Implement caching for frequently accessed data to improve performance</li>
      <li>Scale horizontally if load testing indicates resource constraints</li>
      <li>Regularly run performance tests to track changes over time</li>
    </ul>
  </div>
</body>
</html>
EOF

  step_success "Performance report generated: $REPORT_FILE"

  # Try to open the report in a browser if possible
  if command_exists xdg-open; then
    xdg-open "$REPORT_FILE" &>/dev/null &
  elif command_exists open; then
    open "$REPORT_FILE" &>/dev/null &
  else
    step_info "Report can be viewed by opening $REPORT_FILE in a web browser"
  fi
}

# Main function
main() {
  echo -e "${YELLOW}=== Optionix Performance Monitoring Tool ===${NC}"
  echo -e "${BLUE}$(date)${NC}"

  # Parse command line arguments
  parse_args "$@"

  # Check requirements
  check_requirements

  # Execute command
  case $COMMAND in
    monitor)
      monitor_performance
      ;;
    benchmark)
      run_benchmarks
      ;;
    loadtest)
      run_load_tests
      ;;
    report)
      generate_report
      ;;
  esac

  echo -e "\n${GREEN}Performance operation completed successfully!${NC}"
}

# Run the main function with all arguments
main "$@"
