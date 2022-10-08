import { DesignSystem } from '@napred/browser';
import React from 'react';
import { render } from 'react-dom';
import { Box, MessageInput, Messages } from './components';

import { createClient } from 'graphql-ws';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';


const LAMBDA_WEBSOCKET = process.env.REACT_APP_LAMBA_WEBSOCKET_URI as string;

const getSession: any = () => null;

const link = new GraphQLWsLink(
  createClient({
    url: LAMBDA_WEBSOCKET,
    connectionParams: () => {
      // Note: getSession() is a placeholder function created by you
      const session = getSession();
      if (!session) {
        return {};
      }
      return {
        Authorization: `Bearer ${session.token}`,
      };
    },
  }),
);

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link,
});

function App() {
  return (
    <ApolloProvider client={client}>
      <DesignSystem>
        <Box
          display="flex"
          flexDirection="column"
          height="100vh"
          p={2}
          width="100vw"
        >
          <Messages />
          <MessageInput placeholder="Write a message, press Enter to send" />
        </Box>
      </DesignSystem>
    </ApolloProvider>
  );
}

render(<App />, document.getElementById('root'));
