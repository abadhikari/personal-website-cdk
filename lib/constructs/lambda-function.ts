import { Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';

export interface LambdaFunctionProps {
  /**
   * The runtime of the Lambda function.
   */
  readonly runtime: Runtime;
  /**
   * The directory of the Lambda function code.
   */
  readonly codeDirectory: string;
  /**
   * The method in a Lambda function's code that processes events.
   */
  readonly handler: string;
  /**
   * The amount of memory allocated to the Lambda function in MB.
   */
  readonly memorySize?: number;
  /**
   * The timeout duration for the Lambda function.
   */
  readonly timeout?: Duration;
  /**
   * Key-value pairs that represent environment variables for the Lambda function.
   */
  readonly environment?: { [key: string]: string };
}

/**
 * LambdaFunction is a construct that creates a Lambda function.
 */
export class LambdaFunction extends Construct {
  /**
   * The Lambda function created by this construct.
   */
  public readonly function: Function;

  constructor(scope: Construct, id: string, props: LambdaFunctionProps) {
    super(scope, id);
    this.function = new Function(this, 'LambdaFunction', {
      runtime: props.runtime,
      code: Code.fromAsset(props.codeDirectory),
      handler: props.handler,
      memorySize: props.memorySize || 128,
      timeout: props.timeout || Duration.seconds(3),
      environment: props.environment || {},
    });
  }
}
