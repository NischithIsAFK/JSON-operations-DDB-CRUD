const {
  DynamoDBClient,
  PutItemCommand,
  DeleteItemCommand,
  ScanCommand,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  BatchWriteItemCommand,
  BatchGetItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { unmarshall, marshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({ region: "ap-south-1" });

//For sending back status code with data
function sendResponse(statusCode, body) {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const items = event.body;

  if (event.httpMethod === "POST") {
    // POST request - batch write
    const requestItems = items.map((item) => ({
      PutRequest: {
        Item: marshall({
          userId: "userId_" + Math.random(),
          ...item,
        }),
      },
    }));

    const input = {
      RequestItems: {
        "testing-table-100": requestItems,
      },
    };
    const command = new BatchWriteItemCommand(input);
    try {
      await client.send(command);
      return sendResponse(200, { message: "Batch write successful" });
    } catch (error) {
      return sendResponse(500, { message: "Batch write failed", error });
    }
  } else if (event.httpMethod === "DELETE") {
    // DELETE request - delete an item
    const { id, age } = event.pathParameters || {};
    const input = {
      TableName: "testing-table-100",
      Key: {
        userId: { S: id },
        Age: { S: age },
      },
    };
    try {
      const command = new DeleteItemCommand(input);
      await client.send(command);
      return sendResponse(200, { message: "Item deleted successfully" });
    } catch (error) {
      return sendResponse(500, { message: "Failed to delete item", error });
    }
  } else if (event.httpMethod === "GET") {
    // Handle GET request
    if (event.path === "/all") {
      // Get all items
      const input = {
        TableName: "testing-table-100",
      };
      try {
        const command = new ScanCommand(input);
        const result = await client.send(command);
        const items = result.Items?.map((item) => unmarshall(item)) || [];
        return sendResponse(200, items);
      } catch (error) {
        return sendResponse(500, {
          message: "Failed to retrieve items",
          error,
        });
      }
    } else if (event.resource === "/{id}" && event.pathParameters) {
      const itemId = event.pathParameters.id;
      const input = {
        TableName: "testing-table-100",
        Select: "ALL_ATTRIBUTES",
        KeyConditionExpression: "userId = :userIdValue",
        ExpressionAttributeValues: {
          ":userIdValue": { S: itemId },
        },
      };

      try {
        const command = new QueryCommand(input);
        const result = await client.send(command);
        const resultJSON =
          result.Items?.map((item) => ({
            userId: item?.userId?.S,
            Age: item?.Age?.S,
            height: item?.height?.N,
            income: item?.income?.N,
          })) || [];
        return sendResponse(200, { resultJSON });
      } catch (error) {
        return sendResponse(500, { message: "Failed to retrieve item", error });
      }
    }
  } else if (event.httpMethod === "PUT" && event.resource === "/{id}/{age}") {
    // Handle PUT request - update an item
    const { id, age } = event.pathParameters || {};
    const eventBody = event.body;
    const input = {
      TableName: "testing-table-100",
      Key: {
        userId: { S: id },
        Age: { S: age },
      },
      UpdateExpression: "SET #H = :h, #I = :i",
      ExpressionAttributeNames: {
        "#H": "height",
        "#I": "income",
      },
      ExpressionAttributeValues: {
        ":h": { N: eventBody?.height },
        ":i": { N: eventBody?.income },
      },
      ReturnValues: "ALL_NEW",
    };

    try {
      const command = new UpdateItemCommand(input);
      const data = await client.send(command);
      if (!data?.Attributes) {
        return sendResponse(404, { message: "Item not found" });
      }
      return sendResponse(200, {
        message: "Updated Successfully",
        data: unmarshall(data.Attributes),
      });
    } catch (error) {
      return sendResponse(500, { message: "Failed to update item", error });
    }
  }
};
