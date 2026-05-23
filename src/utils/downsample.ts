/**
 * Largest-Triangle-Three-Buckets (LTTB) algorithm for downsampling time series.
 * Preserves visual features while reducing the number of points.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Downsamples data using the LTTB algorithm.
 * @param data Array of points {x, y}
 * @param threshold Number of points to return
 * @returns Downsampled array
 */
export function lttb(data: Point[], threshold: number): Point[] {
  const dataLength = data.length;
  if (threshold >= dataLength || threshold === 0) {
    return data; // No downsampling needed
  }

  const sampled: Point[] = [];
  let sampledIndex = 0;

  // Bucket size. Leave room for start and end points
  const bucketSize = (dataLength - 2) / (threshold - 2);

  let a = 0; // Point A (last sampled point)
  let maxAreaPoint: Point = data[0];
  let nextA = 0;

  sampled[sampledIndex++] = data[a]; // Always add the first point

  for (let i = 0; i < threshold - 2; i++) {
    // Calculate point B (average of points in the next bucket)
    let avgX = 0;
    let avgY = 0;
    let avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    let avgRangeEnd = Math.floor((i + 2) * bucketSize) + 1;
    avgRangeEnd = avgRangeEnd < dataLength ? avgRangeEnd : dataLength;

    const avgRangeLength = avgRangeEnd - avgRangeStart;

    for (; avgRangeStart < avgRangeEnd; avgRangeStart++) {
      avgX += data[avgRangeStart].x;
      avgY += data[avgRangeStart].y;
    }
    avgX /= avgRangeLength;
    avgY /= avgRangeLength;

    // Get the range for this bucket
    let rangeOffs = Math.floor((i + 0) * bucketSize) + 1;
    const rangeTo = Math.floor((i + 1) * bucketSize) + 1;

    // Point A coordinates
    const pointAx = data[a].x;
    const pointAy = data[a].y;

    let maxArea = -1;

    for (; rangeOffs < rangeTo; rangeOffs++) {
      // Calculate triangle area over three buckets
      const area = Math.abs(
        (pointAx - avgX) * (data[rangeOffs].y - pointAy) -
          (pointAx - data[rangeOffs].x) * (avgY - pointAy)
      ) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        maxAreaPoint = data[rangeOffs];
        nextA = rangeOffs; // Next a is this point
      }
    }

    sampled[sampledIndex++] = maxAreaPoint; // Pick the point with the largest area
    a = nextA; // This point is now the new A for the next iteration
  }

  sampled[sampledIndex++] = data[dataLength - 1]; // Always add the last point

  return sampled;
}

/**
 * Helper to determine the appropriate threshold based on data length.
 * 24h (approx 1440 pts if 1/min) -> 200 pts
 * 7d (approx 10080 pts if 1/min) -> 300 pts
 */
export function downsampleTimeSeries(data: Point[]): { sampledData: Point[], isCompressed: boolean } {
  if (!data || data.length === 0) return { sampledData: [], isCompressed: false };

  let threshold = data.length;
  const dataRangeHours = (data[data.length - 1].x - data[0].x) / (1000 * 60 * 60);

  if (dataRangeHours > 24.5 && dataRangeHours <= 170) {
    // Approx 1 week
    threshold = 300;
  } else if (dataRangeHours <= 24.5 && data.length > 200) {
    // Approx 1 day
    threshold = 200;
  }

  if (data.length <= threshold) {
    return { sampledData: data, isCompressed: false };
  }

  return {
    sampledData: lttb(data, threshold),
    isCompressed: true
  };
}
