// Connect invokes this through its IAM-restricted integration. Never log the incoming event or tokens.
function createHandler(ports, config) {
  return async (event) => {
    const data = event?.Details?.ContactData;
    if (
      !data ||
      data.InstanceARN !== config.instanceArn ||
      data.Channel !== 'CHAT' ||
      !/^[a-f0-9-]{36}$/.test(data.ContactId ?? '')
    )
      throw Error('Unexpected Connect invocation');
    const contactId = data.ContactId,
      instanceId = config.instanceArn.split('/')[1];
    // System-owned subtype is read from AWS, never trusted from user-defined contact attributes.
    const described = await ports.describe({
      InstanceId: instanceId,
      ContactId: contactId,
    });
    if (
      described.Contact?.SegmentAttributes?.['connect:Subtype']?.ValueString !==
      'connect:Apple'
    )
      throw Error('This flow accepts Apple Messages contacts only');
    const existing = await ports.get(contactId);
    if (!existing || Number(existing.expiresAt?.N ?? 0) <= Date.now() / 1000) {
      await ports.startStreaming({
        InstanceId: instanceId,
        ContactId: contactId,
        ClientToken: contactId + '-stream',
        ChatStreamingConfiguration: { StreamingEndpointArn: config.topicArn },
      });
      const participant = await ports.createParticipant({
        InstanceId: instanceId,
        ContactId: contactId,
        ClientToken: contactId + '-bot',
        ParticipantDetails: {
          DisplayName: 'Clinic reception',
          ParticipantRole: 'CUSTOM_BOT',
        },
      });
      const participantToken =
        participant.ParticipantCredentials?.ParticipantToken;
      if (!participantToken)
        throw Error('Connect did not create a participant');
      // Must run within 15 seconds of CreateParticipant, per the Connect contract.
      const connection = await ports.connectParticipant({
        ParticipantToken: participantToken,
        Type: ['CONNECTION_CREDENTIALS'],
        ConnectParticipant: true,
      });
      const credentials = connection.ConnectionCredentials;
      if (!credentials?.ConnectionToken || !credentials.Expiry)
        throw Error('Connect did not return connection credentials');
      await ports.put({
        contactId: { S: contactId },
        instanceArn: { S: config.instanceArn },
        subtype: { S: 'connect:Apple' },
        participantToken: { S: participantToken },
        connectionToken: { S: credentials.ConnectionToken },
        connectionExpiry: { S: credentials.Expiry },
        expiresAt: { N: String(Math.floor(Date.now() / 1000) + 86400) },
      });
    } else if (
      existing.instanceArn?.S !== config.instanceArn ||
      existing.subtype?.S !== 'connect:Apple'
    )
      throw Error('Session ownership mismatch');
    await ports.publish({
      TopicArn: config.topicArn,
      Message: JSON.stringify({ event: 'session.started' }),
      MessageAttributes: {
        ContactId: { DataType: 'String', StringValue: contactId },
        InstanceId: { DataType: 'String', StringValue: instanceId },
        AccountId: {
          DataType: 'String',
          StringValue: config.instanceArn.split(':')[4],
        },
      },
    });
    return { ready: 'true' };
  };
}
exports.createHandler = createHandler;
let handler;
exports.handler = async (event) => {
  if (!handler) {
    const {
      ConnectClient,
      DescribeContactCommand,
      StartContactStreamingCommand,
      CreateParticipantCommand,
    } = require('@aws-sdk/client-connect');
    const {
      ConnectParticipantClient,
      CreateParticipantConnectionCommand,
    } = require('@aws-sdk/client-connectparticipant');
    const {
      DynamoDBClient,
      GetItemCommand,
      PutItemCommand,
    } = require('@aws-sdk/client-dynamodb');
    const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    const connect = new ConnectClient({ maxAttempts: 1 }),
      participant = new ConnectParticipantClient({ maxAttempts: 1 }),
      dynamo = new DynamoDBClient({ maxAttempts: 1 }),
      sns = new SNSClient({ maxAttempts: 1 });
    const table = process.env.SESSION_TABLE;
    handler = createHandler(
      {
        describe: (input) => connect.send(new DescribeContactCommand(input)),
        startStreaming: (input) =>
          connect.send(new StartContactStreamingCommand(input)),
        createParticipant: (input) =>
          connect.send(new CreateParticipantCommand(input)),
        connectParticipant: (input) =>
          participant.send(new CreateParticipantConnectionCommand(input)),
        get: async (id) =>
          (
            await dynamo.send(
              new GetItemCommand({
                TableName: table,
                Key: { contactId: { S: id } },
                ConsistentRead: true,
              }),
            )
          ).Item,
        put: (Item) =>
          dynamo.send(new PutItemCommand({ TableName: table, Item })),
        publish: (input) => sns.send(new PublishCommand(input)),
      },
      {
        instanceArn: process.env.CONNECT_INSTANCE_ARN,
        topicArn: process.env.TOPIC_ARN,
      },
    );
  }
  try {
    return await handler(event);
  } catch {
    // Lambda logs uncaught errors; keep SDK errors and session details out of them.
    throw Error(
      'Apple bootstrap failed. Check instance access and the private session configuration.',
    );
  }
};
