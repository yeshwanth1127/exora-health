// Generate a reviewable CloudFormation template. This script does not deploy resources.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export function appleConnectTemplate() {
  const ref = (name) => ({ Ref: name }),
    arn = (name) => ({ 'Fn::GetAtt': [name, 'Arn'] }),
    sub = (value) => ({ 'Fn::Sub': value });
  return {
    AWSTemplateFormatVersion: '2010-09-09',
    Description:
      'HMS Apple Messages demo bridge: private SNS/SQS and CUSTOM_BOT session credentials',
    Parameters: {
      ConnectInstanceArn: {
        Type: 'String',
        AllowedPattern:
          'arn:aws:connect:[a-z0-9-]+:[0-9]{12}:instance/[a-f0-9-]{36}',
      },
    },
    Resources: {
      Sessions: {
        Type: 'AWS::DynamoDB::Table',
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
        Properties: {
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: 'contactId', AttributeType: 'S' },
          ],
          KeySchema: [{ AttributeName: 'contactId', KeyType: 'HASH' }],
          TimeToLiveSpecification: {
            AttributeName: 'expiresAt',
            Enabled: true,
          },
          SSESpecification: { SSEEnabled: true },
        },
      },
      DeadLetters: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          MessageRetentionPeriod: 1209600,
          SqsManagedSseEnabled: true,
        },
      },
      Inbox: {
        Type: 'AWS::SQS::Queue',
        Properties: {
          MessageRetentionPeriod: 86400,
          VisibilityTimeout: 120,
          SqsManagedSseEnabled: true,
          RedrivePolicy: {
            deadLetterTargetArn: arn('DeadLetters'),
            maxReceiveCount: 10,
          },
        },
      },
      Topic: { Type: 'AWS::SNS::Topic' },
      TopicPolicy: {
        Type: 'AWS::SNS::TopicPolicy',
        Properties: {
          Topics: [ref('Topic')],
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'connect.amazonaws.com' },
                Action: 'sns:Publish',
                Resource: ref('Topic'),
                Condition: {
                  StringEquals: { 'aws:SourceAccount': ref('AWS::AccountId') },
                  ArnEquals: { 'aws:SourceArn': ref('ConnectInstanceArn') },
                },
              },
            ],
          },
        },
      },
      QueuePolicy: {
        Type: 'AWS::SQS::QueuePolicy',
        Properties: {
          Queues: [ref('Inbox')],
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'sns.amazonaws.com' },
                Action: 'sqs:SendMessage',
                Resource: arn('Inbox'),
                Condition: {
                  ArnEquals: { 'aws:SourceArn': ref('Topic') },
                  StringEquals: { 'aws:SourceAccount': ref('AWS::AccountId') },
                },
              },
            ],
          },
        },
      },
      Subscription: {
        Type: 'AWS::SNS::Subscription',
        DependsOn: 'QueuePolicy',
        Properties: {
          TopicArn: ref('Topic'),
          Protocol: 'sqs',
          Endpoint: arn('Inbox'),
          RawMessageDelivery: false,
        },
      },
      Role: {
        Type: 'AWS::IAM::Role',
        Properties: {
          AssumeRolePolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { Service: 'lambda.amazonaws.com' },
                Action: 'sts:AssumeRole',
              },
            ],
          },
          ManagedPolicyArns: [
            'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
          Policies: [
            {
              PolicyName: 'AppleBootstrap',
              PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                  {
                    Effect: 'Allow',
                    Action: [
                      'connect:DescribeContact',
                      'connect:StartContactStreaming',
                      'connect:CreateParticipant',
                    ],
                    Resource: [
                      ref('ConnectInstanceArn'),
                      sub('${ConnectInstanceArn}/contact/*'),
                    ],
                  },
                  {
                    Effect: 'Allow',
                    Action: ['dynamodb:GetItem', 'dynamodb:PutItem'],
                    Resource: arn('Sessions'),
                  },
                  {
                    Effect: 'Allow',
                    Action: 'sns:Publish',
                    Resource: ref('Topic'),
                  },
                ],
              },
            },
          ],
        },
      },
      Bootstrap: {
        Type: 'AWS::Lambda::Function',
        Properties: {
          Runtime: 'nodejs22.x',
          Handler: 'index.handler',
          Timeout: 8,
          MemorySize: 256,
          Role: arn('Role'),
          Code: {
            ZipFile: readFileSync(
              new URL('./bootstrap.cjs', import.meta.url),
              'utf8',
            ),
          },
          Environment: {
            Variables: {
              CONNECT_INSTANCE_ARN: ref('ConnectInstanceArn'),
              TOPIC_ARN: ref('Topic'),
              SESSION_TABLE: ref('Sessions'),
            },
          },
        },
      },
      InvokePermission: {
        Type: 'AWS::Lambda::Permission',
        Properties: {
          FunctionName: ref('Bootstrap'),
          Action: 'lambda:InvokeFunction',
          Principal: 'connect.amazonaws.com',
          SourceArn: ref('ConnectInstanceArn'),
          SourceAccount: ref('AWS::AccountId'),
        },
      },
      Association: {
        Type: 'AWS::Connect::IntegrationAssociation',
        Properties: {
          InstanceId: ref('ConnectInstanceArn'),
          IntegrationType: 'LAMBDA_FUNCTION',
          IntegrationArn: arn('Bootstrap'),
        },
      },
      WorkerPolicy: {
        Type: 'AWS::IAM::ManagedPolicy',
        Properties: {
          Description:
            'Attach only to the company demo worker identity, never a clinic staff user',
          PolicyDocument: {
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'sqs:ReceiveMessage',
                  'sqs:DeleteMessage',
                  'sqs:GetQueueAttributes',
                ],
                Resource: arn('Inbox'),
              },
              {
                Effect: 'Allow',
                Action: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
                Resource: arn('Sessions'),
              },
            ],
          },
        },
      },
    },
    Outputs: {
      InstanceArn: { Value: ref('ConnectInstanceArn') },
      TopicArn: { Value: ref('Topic') },
      QueueUrl: { Value: ref('Inbox') },
      SessionTable: { Value: ref('Sessions') },
      BootstrapLambdaArn: { Value: arn('Bootstrap') },
      WorkerPolicyArn: { Value: ref('WorkerPolicy') },
      DeadLetterQueueUrl: { Value: ref('DeadLetters') },
    },
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  process.stdout.write(JSON.stringify(appleConnectTemplate(), null, 2) + '\n');
