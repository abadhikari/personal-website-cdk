import { Duration } from 'aws-cdk-lib';
import {
  CachePolicy,
  CacheQueryStringBehavior,
  CacheHeaderBehavior,
  CacheCookieBehavior,
} from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';

/**
 * Properties for configuring the ApiCachePolicy construct.
 */
export interface ApiCachePolicyProps {
  /**
   * Default TTL for cached responses.
   */
  readonly defaultTtlSeconds?: number;

  /**
   * Minimum TTL for cached responses.
   */
  readonly minTtlSeconds?: number;

  /**
   * Maximum TTL for cached responses.
   */
  readonly maxTtlSeconds?: number;

  /**
   * Query parameters that affect the response (cache key allow-list).
   */
  readonly queryParams?: string[];
}

/**
 * ApiCachePolicy creates a CloudFront CachePolicy for API responses.
 *
 * Configured to cache based on all query strings and no cookies or headers.
 */
export class ApiCachePolicy extends Construct {
  /**
   * The CloudFront CachePolicy created by this construct.
   */
  public readonly cachePolicy: CachePolicy;

  constructor(scope: Construct, id: string, props?: ApiCachePolicyProps) {
    super(scope, id);

    const queryStringBehavior = props?.queryParams
      ? props.queryParams.length > 0
        ? CacheQueryStringBehavior.allowList(...props.queryParams)
        : CacheQueryStringBehavior.none()
      : CacheQueryStringBehavior.none();

    this.cachePolicy = new CachePolicy(this, 'ApiCachePolicy', {
      queryStringBehavior,
      headerBehavior: CacheHeaderBehavior.allowList('Origin'),
      cookieBehavior: CacheCookieBehavior.none(),
      defaultTtl: Duration.seconds(props?.defaultTtlSeconds ?? 300),
      minTtl: Duration.seconds(props?.minTtlSeconds ?? 0),
      maxTtl: Duration.seconds(props?.maxTtlSeconds ?? 600),
    });
  }
}
