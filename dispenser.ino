#include <ArduinoJson.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ESP32Servo.h>
#include "AmazonVariables.h"
#include "HX711.h"
#define DT 13   // DT de HX711 a pin digital 2
#define SCK 14  // SCK de HX711 a pin digital 3


extern const char PRIVATE_KEY[] PROGMEM;
extern const char CERTIFICATE[] PROGMEM;
extern const char AMAZON_ROOT_CA1[] PROGMEM;
const char *WIFI_SSID = "POCO X3 Pro";
const char *WIFI_PASS = "mateo1234";

const char *ENDPOINT = "assa27mawgrqi-ats.iot.us-east-1.amazonaws.com";
const int PORT = 8883;

const char *MQTT_CLIENT_ID = "op";
const char *UPDATE_ACCEPTED_TOPIC = "$aws/things/dispenser/shadow/update/accepted";
const char *UPDATE_TOPIC = "$aws/things/dispenser/shadow/update";

const char *RULE_TOPIC = "dispenser/rule";

Servo servo;
HX711 cell;

const int SERVO_PIN = 25;

WiFiClientSecure wiFiClient;
PubSubClient mqttClient(wiFiClient);

float distance;

const int LED_PIN = 33;
const int TRIG = 26;
const int ECHO = 27;

float stock;
String dispenserState = "unknown";

StaticJsonDocument<128> outputDoc;
char outputBuffer[128];


long readUltrasonicDistance(int triggerPin, int echoPin) {
  pinMode(triggerPin, OUTPUT);
  digitalWrite(triggerPin, LOW);
  delayMicroseconds(2);
  digitalWrite(triggerPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(triggerPin, LOW);
  pinMode(echoPin, INPUT);
  return pulseIn(echoPin, HIGH);
}

void reportDispenserState() {
  outputDoc.clear();
  outputDoc["state"]["reported"]["dispenserState"] = dispenserState;
  outputDoc["state"]["reported"]["distance"] = distance;
  outputDoc["state"]["reported"]["stock"] = stock;
  serializeJson(outputDoc, outputBuffer);
  mqttClient.publish(UPDATE_TOPIC, outputBuffer);
}

void setDispenserState(String str) {
  dispenserState = str;
  if (dispenserState == "Off") {
    digitalWrite(LED_BUILTIN, LOW);

  } else if (dispenserState == "On") {
    servo.write(180);
    delay(1000);
    servo.write(0);
    digitalWrite(LED_BUILTIN, HIGH);
    distance = 0.01723 * readUltrasonicDistance(TRIG, ECHO);
    delay(5000);
    stock = cell.get_units(10);
    Serial.println(stock);
    Serial.println(distance);
    dispenserState = "Off";
  }
  reportDispenserState();
}

StaticJsonDocument<256> inputDoc;

void setLedState(String ledState) {
  if (ledState == "ledOn") {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}

void callback(char *topic, byte *payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  if (String(topic) == RULE_TOPIC) {
    Serial.println("Message from rule");
    DeserializationError err = deserializeJson(inputDoc, payload);
    if (!err) {
      String str = String(inputDoc["action"].as<const char *>());
      if (!str.isEmpty()) {
        setLedState(str);
      } 
    }
  } else if (String(topic) == UPDATE_ACCEPTED_TOPIC) {
    Serial.print("Message from topic ");
    Serial.print(topic);
    Serial.print(": ");
    Serial.println(message);
    DeserializationError err = deserializeJson(inputDoc, payload, length);
    if (!err) {
      const char *tmpDispenserState = inputDoc["state"]["desired"]["dispenserState"];
      if (tmpDispenserState && strcmp(tmpDispenserState, dispenserState.c_str()) != 0) {
        setDispenserState(tmpDispenserState);        
        setLedState("ledOff");
      
      }
    }
  }
}

boolean mqttClientConnect() {
  if (!mqttClient.connected()) {
    Serial.print("Connecting to ");
    Serial.print(ENDPOINT);
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      if (mqttClient.subscribe(UPDATE_ACCEPTED_TOPIC)) {
        Serial.println("Subscribed to " + String(UPDATE_ACCEPTED_TOPIC));
      } else Serial.println("Can't subscribe to " + String(UPDATE_ACCEPTED_TOPIC));

      if (mqttClient.subscribe(RULE_TOPIC)) {
        Serial.println("Subscribed to " + String(RULE_TOPIC));
      } else Serial.println("Can't subscribe to " + String(RULE_TOPIC));
      delay(2000);
    }
  }
  return mqttClient.connected();
}

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);
  servo.attach(SERVO_PIN);
  Serial.print("Connecting to ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(200);
    Serial.print(".");
  }
  Serial.println(" DONE!");
  wiFiClient.setCACert(AMAZON_ROOT_CA1);
  wiFiClient.setCertificate(CERTIFICATE);
  wiFiClient.setPrivateKey(PRIVATE_KEY);
  mqttClient.setServer(ENDPOINT, PORT);
  mqttClient.setCallback(callback);
  cell.begin(DT, SCK);
  cell.set_scale(465.f);
  cell.tare();
}

void loop() {
  if (!mqttClient.connected()) {
    if (mqttClientConnect()) {
    } else {
      delay(1000);
    }
  } else {
    mqttClient.loop();
    delay(20);
  }
}
