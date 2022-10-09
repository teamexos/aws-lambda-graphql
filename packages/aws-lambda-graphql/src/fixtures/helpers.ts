import { Client, SubscribePayload, ExecutionResult } from 'graphql-ws';

export function waitForClientToConnect(client: Client) {
  return new Promise((resolve) => {
    client.on('connected', resolve);
  });
}

export function execute({
  client,
  extensions,
  operationName,
  query,
  variables,
}: { client: Client } & SubscribePayload): Promise<ExecutionResult> {
  return new Promise((resolve, reject) => {
    try {
      const subscribePayload = {
        extensions,
        operationName,
        query,
        variables,
      };

      let value;
      const subscriber = {
        next(val) {
          value = val;
          // Apollo client does not call complete() on query/mutation operations
          resolve(value);
        },
        complete() {
          resolve(value);
        },
        error(err) {
          reject(err);
        },
      };

      client.subscribe(subscribePayload, subscriber);
    } catch (e) {
      reject(e);
    }
  });
}

export function subscribe({
  client,
  extensions,
  operationName,
  query,
  variables,
}: { client: Client } & SubscribePayload): Iterator<any> {
  const subscribePayload = {
    extensions,
    operationName,
    query,
    variables,
  };

  const events: any[] = [];
  const subscriber = {
    next(event: any) {
      events.push(event);
    },
    complete() {
      events.push(new Error('Subscription cannot be done'));
    },
    error(err: any) {
      events.push(err);
    },
  };

  client.subscribe(subscribePayload, subscriber);

  return {
    next() {
      const event = events.shift();

      if (event) {
        if (event instanceof Error) {
          throw event;
        }

        return { done: false, value: event };
      }

      client.dispose();

      return { done: true, value: undefined };
    },
  };
}
