import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

/**
 * Properties for configuring the ApiCloudFrontDistribution construct.
 */
export interface ApiCloudFrontDistributionProps {
  /**
   * The API Gateway regional domain name (e.g., abc123.execute-api.us-east-1.amazonaws.com)
   */
  readonly apiGatewayRegionalDomain: string;

  /**
   * The public API domain names (e.g., [api.abhinnaadhikari.com])
   */
  readonly publicApiDomains: string[];

  /**
   * ACM certificate for the public API domain (must be in us-east-1 for CloudFront)
   */
  readonly certificate: ICertificate;

  /**
   * Optional stage path for the API Gateway deployment (e.g., '/prod').
   */
  readonly stagePath?: string;

  /**
   * Default allowed HTTP methods for the distribution's default behavior.
   */
  readonly customAllowedMethods?: AllowedMethods;

  /**
   * Cache policy for the distribution's default behavior.
   */
  readonly customCachePolicy?: CachePolicy;

  /**
   * Origin request policy for the distribution's default behavior (controls what CloudFront forwards).
   */
  readonly customOriginRequestPolicy?: OriginRequestPolicy;
}

/**
 * ApiCloudFrontDistribution creates a CloudFront distribution in front of an API Gateway.
 *
 * Configured to cache GET/HEAD requests based on the provided CachePolicy.
 */
export class ApiCloudFrontDistribution extends Construct {
  /**
   * The CloudFront distribution created by this construct.
   */
  public readonly distribution: Distribution;

  private readonly origin: HttpOrigin;

  constructor(
    scope: Construct,
    id: string,
    props: ApiCloudFrontDistributionProps,
  ) {
    super(scope, id);

    this.origin = new HttpOrigin(props.apiGatewayRegionalDomain, {
      originPath: props.stagePath || '',
    });

    this.distribution = new Distribution(this, 'ApiCloudFrontDistribution', {
      domainNames: props.publicApiDomains,
      certificate: props.certificate,
      defaultBehavior: {
        origin: this.origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: props.customAllowedMethods ?? AllowedMethods.ALLOW_ALL,
        cachePolicy: props.customCachePolicy ?? CachePolicy.CACHING_DISABLED,
        originRequestPolicy:
          props.customOriginRequestPolicy ??
          OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });
  }

  /**
   * Adds a CloudFront behavior for a path pattern.
   *
   * Use this to enable caching on specific read-only routes while the default behavior stays no-cache.
   * Keep the cache key and origin forwarding aligned (same query params in both policies).
   *
   * @param pathPattern - Viewer path pattern to match (e.g. '/v1/reviews*').
   * @param cachePolicy - Cache policy to use (e.g. 10-min TTL; vary by needed query params only).
   * @param originRequestPolicy - What CloudFront forwards to the origin (mirror the cache policy’s QS).
   * @param allowedMethods - Allowed methods (default: GET/HEAD/OPTIONS).
   */
  public addSimpleBehavior(
    pathPattern: string,
    cachePolicy: CachePolicy,
    originRequestPolicy: OriginRequestPolicy,
    allowedMethods: AllowedMethods = AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
  ): void {
    this.distribution.addBehavior(pathPattern, this.origin, {
      viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods,
      cachePolicy,
      originRequestPolicy,
    });
  }
}
