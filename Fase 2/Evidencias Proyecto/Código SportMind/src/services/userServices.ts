import { 
  CognitoIdentityProviderClient, 
  AdminCreateUserCommand, 
  AdminAddUserToGroupCommand 
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: import.meta.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: import.meta.env.AWS_SESSION_TOKEN,
  }
});

const USER_POOL_ID = import.meta.env.AWS_USER_POOL_ID;

export interface NuevoEspecialista {
  email: string;
  nombre: string;
  telefono?: string;
  password: string;
  rol: string;
}

export async function registrarEspecialistaCognito(datos: NuevoEspecialista) {
  const { email, nombre, password } = datos;

  const usernameUnico = `esp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 1. Crear usuario indicando explícitamente que el medio de entrega sea solo EMAIL
  const createUserCmd = new AdminCreateUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: usernameUnico,
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "name", Value: nombre },
      { Name: "email_verified", Value: "true" }
    ],
    TemporaryPassword: password,
    DesiredDeliveryMediums: ["EMAIL"], // Evita el uso de SMS
  });

  await client.send(createUserCmd);

  // 2. Asignarlo al grupo "especialista"
  const addToGroupCmd = new AdminAddUserToGroupCommand({
    UserPoolId: USER_POOL_ID,
    Username: usernameUnico,
    GroupName: "especialista"
  });

  await client.send(addToGroupCmd);

  return { success: true, message: "Especialista registrado correctamente en Cognito" };
}