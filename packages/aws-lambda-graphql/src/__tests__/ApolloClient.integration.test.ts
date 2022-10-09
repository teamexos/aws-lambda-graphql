import { createClient } from 'graphql-ws';
import {
  execute,
  subscribe,
  waitForClientToConnect,
} from '../fixtures/helpers';
import { TestLambdaServer } from '../fixtures/server';

describe('apollo client integration test', () => {
  let server: TestLambdaServer;

  beforeEach(async () => {
    server = new TestLambdaServer({
      port: 3002,
      onConnect: (messagePayload) => {
        if (messagePayload.isUnauthorized) {
          return false;
        }
        return messagePayload;
      },
    });

    await server.start();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('connect', () => {
    it('connects to server', (done) => {
      const client = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { authorId: '1' },
        on: { connected: (_socket) => done() },
      });

      subscribe({
        client,
        operationName: 'test',
        query: `
          subscription test {
            textFeed
          }
        `,
      });
    });

    it('disconnects unauthorized client', (done) => {
      const client = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { isUnauthorized: true },
        on: { closed: (_socket) => done() },
      });

      subscribe({
        client,
        operationName: 'test',
        query: `
          subscription test {
            textFeed
          }
        `,
      });
    });
  });

  describe('subscriptions', () => {
    it('streams results from a subscription', async () => {
      const client1 = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { authorId: '1' },
      });
      const client2 = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { authorId: '2' },
      });

      const operation1Iterator = subscribe({
        client: client1,
        operationName: 'test',
        query: `
          subscription test {
            textFeed
          }
        `,
      });
      const operation2Iterator = subscribe({
        client: client2,
        operationName: 'test',
        query: `
          subscription test {
            textFeed
          }
        `,
      });

      const w1 = waitForClientToConnect(client1);
      const w2 = waitForClientToConnect(client2);
      await Promise.all([w1, w2]);

      // now publish all messages
      await Promise.all(
        [
          ['1', 'Test1'],
          ['2', 'Test2'],
          ['1', 'Test3'],
          ['2', 'Test4'],
        ].map(([authorId, text]) =>
          execute({
            client: client1,
            operationName: 'publish',
            query: `
              mutation publish($authorId: ID!, $text: String!) {
                testPublish(authorId: $authorId, text: $text)
              }
            `,
            variables: {
              authorId,
              text,
            },
          }),
        ),
      );

      // wait for event processor to process events
      await new Promise((r) => setTimeout(r, 200));

      expect(operation1Iterator.next()).toEqual({
        done: false,
        value: { data: { textFeed: 'Test1' } },
      });
      expect(operation1Iterator.next()).toEqual({
        done: false,
        value: { data: { textFeed: 'Test3' } },
      });
      expect(operation1Iterator.next()).toEqual({
        done: true,
        value: undefined,
      });

      expect(operation2Iterator.next()).toEqual({
        done: false,
        value: { data: { textFeed: 'Test2' } },
      });
      expect(operation2Iterator.next()).toEqual({
        done: false,
        value: { data: { textFeed: 'Test4' } },
      });
      expect(operation2Iterator.next()).toEqual({
        done: true,
        value: undefined,
      });
    });
  });

  describe('operation', () => {
    it('sends an operation and receives a result (success)', async () => {
      const client = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { authorId: '1' },
      });

      const result = await execute({
        client,
        query: `
          {
            testQuery
          }
        `,
      });

      expect(result).toEqual({ data: { testQuery: 'test' } });
    });

    it('sends an operation and receives a result (failure)', async () => {
      const client = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { authorId: '1' },
      });

      const result = await execute({
        client,
        query: `
          {
            notExisting
          }
        `,
      });

      expect(result.errors).toBeDefined();
    });

    it('passes context to operation and gets context property back', async () => {
      const client = createClient({
        url: 'ws://localhost:3002',
        connectionParams: { foo: 'bar', authorId: '1' },
      });

      const result = await execute({
        client,
        query: `
          {
            getFooPropertyFromContext
          }
        `,
      });

      expect(result).toEqual({ data: { getFooPropertyFromContext: 'bar' } });
    });
  });
});
