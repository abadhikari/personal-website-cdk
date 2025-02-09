# Infrastructure

This repository contains AWS CDK Typescript code that provisions the backend infrastructure for the photos and reviews page of my website [abhinnaadhikari.com](https://abhinnaadhikari.com). By leveraging CDK, this project provides infrastructure as code (IaC) that can be versioned, tested, and deployed.

## ReviewsPageStack

The ReviewsPageStack creates and configures the following AWS resources:

- **VPC** with a custom subnet configuration (using only isolated subnets for enhanced security)
- **Amazon RDS** instance (PostgreSQL) for storing review data
- **AWS Secrets Manager** secret to securely store RDS credentials
- **API Gateway** REST API for handling HTTP requests related to reviews

## PhotosPageStack

The PhotosPageStack creates and configures the following AWS resources:

- **S3 Bucket** for storing media assets (photos and videos)
- **CloudFront Distribution** for efficiently serving media assets from the S3 bucket
- **DynamoDB Tables** for managing metadata of media files and media stacks (e.g., albums)
- **Lambda Functions** for reading, writing, and generating signed URLs for media assets
- **API Gateway** REST API for handling HTTP requests related to media

## AuthStack

The AuthStack creates and configures the following AWS resources:

- **Cognito Admin User Pool:** Provides a secure user directory for administrative access.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Testing](#testing)
- [cdk.context.json](#cdkcontextjson)
- [License](#license)

## Features

- **Custom VPC Construct:**  
  Configurable to span multiple Availability Zones with a custom subnet configuration. In this case, only isolated subnets are created to host internal resources.

- **Secure RDS Deployment:**  
  Deploys a PostgreSQL RDS instance storing credentials in Secrets Manager.

- **API Gateway Integration:**  
  Sets up an API Gateway to route HTTPS requests to Lambda functions via HTTPS endpoints, enabling operations such as GET and POST for media and reviews management.

- **Media Storage:**  
  An S3 bucket is provisioned to store media assets (photos and videos) with specific CORS rules configured to allow uploads.

- **Content Delivery:**  
  A CloudFront distribution is set up to serve media assets with low latency and improved global performance.

- **Metadata Management:**  
  Two DynamoDB tables are created:

  - A **Media Metadata Table** to store details about individual media files.
  - A **Stack Metadata Table** to store details about media stacks (e.g., albums), complete with Global Secondary Index (GSI) configuration for flexible querying.

- **Serverless Functions:**  
  Three Lambda functions are deployed:

  - **ReadMediaLambda** for retrieving media metadata.
  - **WriteMediaLambda** for writing media metadata.
  - **GenerateSignedMediaUrlLambda** for generating signed URLs to facilitate secure media uploads.

- **Authentication Integration:**  
  The stack integrates with an Cognito to secure write/admin operations.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [AWS CLI](https://aws.amazon.com/cli/) (configured with appropriate credentials)
- [AWS CDK v2](https://docs.aws.amazon.com/cdk/v2/guide/home.html)
- An AWS account with permissions to create VPCs, RDS, API Gateway, etc.

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/abadhikari/personal-website-cdk.git
   cd personal-website-cdk
   ```

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Bootstrap the CDK Environment (if not already done):**

   The CDK bootstrap process sets up the necessary resources for deployment.

   ```bash
   npx cdk bootstrap
   ```

## Usage

Before deploying, you can run the following to see if your changes pass the tests and also to display a diff of the changes.

```bash
npm run prepare
```

Once the changes look fine and tests pass, the stacks in this project can be deployed with `npm run deploy --` followed by the stack name:

```bash
npm run deploy -- ReviewsPageStack
```

This command synthesizes the CloudFormation template, displays a diff of the changes, and deploys the stack.

## Testing

The project includes tests that verify resource creation and configuration. To run the tests:

```bash
npm run test
```

The tests use the AWS CDK assertions library to ensure that resources such as the VPC, RDS DB instance, Secrets Manager secret, API Gateway, and DB subnet group are configured as expected.

## cdk.context.json

During synthesis, AWS CDK automatically generates a `cdk.context.json` file that caches environment context (such as VPC details, available AZs, etc.). This file helps speed up subsequent syntheses and deployments. It is safe to commit this file to source control if you want consistent deployments.

## Useful commands

- `npm run build` compile typescript to js
- `npm run watch` watch for changes and compile
- `npm run test` perform the jest unit tests
- `npx cdk deploy` deploy this stack to your default AWS account/region
- `npx cdk diff` compare deployed stack with current state
- `npx cdk synth` emits the synthesized CloudFormation template

The `cdk.json` file tells the CDK Toolkit how to execute the app.

## License

This project is licensed under the [MIT License](LICENSE).
