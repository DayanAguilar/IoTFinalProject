const Alexa = require("ask-sdk-core");
const AWS = require("aws-sdk");
const TABLE_NAME = "users";
const IotData = new AWS.IotData({
  endpoint: "assa27mawgrqi-ats.iot.us-east-1.amazonaws.com",
});
const clientesTable = new AWS.DynamoDB.DocumentClient({
  region: "us-east-1",
});
var sesion = false;

const TurnOnParams = {
  topic: "$aws/things/dispenser/shadow/update",
  payload: '{"state": {"desired": {"dispenserState": "On"}}}',
  qos: 0,
};

const TurnOffParams = {
  topic: "$aws/things/dispenser/shadow/update",
  payload: '{"state": {"desired": {"dispenserState": "Off"}}}',
  qos: 0,
};

function checkUserThing(userId, thingId) {
  const params = {
    TableName: TABLE_NAME,
    Key: {
      user_id: userId,
      thing_id: thingId,
    },
  };

  return new Promise((resolve, reject) => {
    clientesTable.get(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        if (!data || !data.Item) {
          resolve(false);
        } else {
          resolve(true);
        }
      }
    });
  });
}

async function encontro(userId, thingId) {
  try {
    const encontrado = await checkUserThing(userId, thingId);
    if (encontrado) {
      return 0;
    } else {
      return 1;
    }
  } catch (error) {
    console.error("Error al buscar el elemento:", error);
  }
}

function registerUserThing(userId, thingId) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      user_id: userId,
      thing_id: thingId,
    },
  };

  clientesTable.put(params, function (err, data) {
    if (err) {
      console.log("Unable to add item", err);
    } else {
      console.log("Item added successfully");
    }
  });
}

function getShadowPromise(params) {
  return new Promise((resolve, reject) => {
    IotData.getThingShadow(params, (err, data) => {
      if (err) {
        console.log(err, err.stack);
        reject("Failed to get thing shadow ${err.errorMessage}");
      } else {
        resolve(JSON.parse(data.payload));
      }
    });
  });
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  async handle(handlerInput) {
    let speakOutput = "";
    const user_id = handlerInput.requestEnvelope.context.System.user.userId;
    const thing_id = handlerInput.requestEnvelope.context.System.device.deviceId;
    var estado = await encontro(user_id, thing_id);
    if (estado == 1) {
      registerUserThing(user_id, thing_id);
      speakOutput = "Registrando dispensador de comida";
      sesion = true;
    } else {
      sesion = true;
      speakOutput = "Bienvenido al dispensador de comida";
    }
    console.log(estado);
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const StopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent"
    );
  },
  handle(handlerInput) {
    var speakOutput = "";
    if (sesion) {
      speakOutput = "saliendo";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    var speakOutput = "";
    if (sesion) {
      speakOutput =
        "Puedes prender el dispensador, preguntar cuanta cantidad de comida queda en el dispensador y cuanta comida hay en el plato y el led se enciende si la comida en el dispenser es poca";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};
const ShadowParams = {
  thingName: "dispenser",
};

const QueryStateIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "QueryStateIntent"
    );
  },
  async handle(handlerInput) {
    var speakOutput = "";
    if (sesion) {
      speakOutput = "Sesion iniciada";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};



const TurnOnIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "TurnOnIntent"
    );
  },
  handle(handlerInput) {
    var speakOutput = "Error";
    IotData.publish(TurnOnParams, function (err, data) {
      if (err) console.log(err);
    });
    if (sesion) {
      speakOutput = "Alimentando";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};

const TurnOffIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "TurnOffIntent"
    );
  },
  handle(handlerInput) {
    var speakOutput = "Error";
    IotData.publish(TurnOffParams, function (err, data) {
      if (err) console.log(err);
    });
    if (sesion) {
      speakOutput = "Dejando de alimentar";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};

const InterruptIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "InterruptIntent"
    );
  },
  handle(handlerInput) {
    var speakOutput = "";
    if (sesion) {
      speakOutput = "Interrumpiendo";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};

function setDistanceAndWeight(distance, weight){
   let message = "";
   if(distance<17){
      if(distance>13){
         message = "La comida en el dispensador es poca, exactamente " + weight.substring(0, 3) + " gramos";
      }
      if(distance>8 && distance<=13){
         message = "La comida en el dispensador es suficiente, exactamente " + weight.substring(0, 3) + " gramos";
      }
      if(distance>0 && distance<=8){
         message = "La comida en el dispensador esta bien, exactamente " + weight.substring(0, 3) + " gramos";
      }
   }
   return message;
}

const StockIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "StockIntent"
    );
  },
  async handle(handlerInput) {
    var distance = 0;
    await getShadowPromise(ShadowParams).then(
      (result) => (distance = result.state.reported.distance),
    );
    console.log(distance);
    let weight =
      0.0054 * Math.pow(distance, 4) -
      0.6855 * Math.pow(distance, 3) +
      21.644 * Math.pow(distance, 2) -
      272.73 * distance +
      1298;
    var speakOutput = "";
    if (sesion) {
      speakOutput = setDistanceAndWeight(distance,weight.toString())
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};
const FoodInPlateIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "FoodInPlateIntent"
    );
  },
  async handle(handlerInput) {
    var stock = 0;
    await getShadowPromise(ShadowParams).then(
      (result) => (stock = result.state.reported.stock),
    );
    var speakOutput = "";
    if (sesion) {
      speakOutput =
        "queda" + stock + " gramos cantidad de comida en el plato de comida";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      speakOutput = "Error";
      return handlerInput.responseBuilder.speak(speakOutput).getResponse();
    }
  },
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    TurnOnIntentHandler,
    TurnOffIntentHandler,
    QueryStateIntentHandler,
    InterruptIntentHandler,
    StockIntentHandler,
    FoodInPlateIntentHandler,
    StopIntentHandler,
    HelpIntentHandler,
  )
  .lambda();
