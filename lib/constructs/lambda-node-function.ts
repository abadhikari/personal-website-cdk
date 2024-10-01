import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import {
  NodejsFunction,
  NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';

export interface LambdaNodeFunctionProps extends NodejsFunctionProps {
  /**
   * The name of the Lambda function.
   */
  readonly functionName: string;
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
 * LambdaNodeFunction is a construct that creates a Node.js Lambda function using NodejsFunction.
 * 
 * NodejsFunction handles transpilation of typescript files to javascript, all the bundling
 * of dependencies for the lambda, and even size optimization! 
 */
export class LambdaNodeFunction extends Construct {
  /**
   * The Node.js Lambda function created by this construct.
   */
  public readonly function: NodejsFunction;

  constructor(scope: Construct, id: string, props: LambdaNodeFunctionProps) {
    super(scope, id);
    this.function = new NodejsFunction(this, 'LambdaNodeFunction', {
      entry: props.entry,
      handler: props.handler,
      functionName: props.functionName,
      runtime: props.runtime,
      memorySize: props.memorySize || 128,
      timeout: props.timeout || Duration.seconds(3),
      environment: props.environment || {},
      bundling: props.bundling || { minify: true },
    });
  }
}
