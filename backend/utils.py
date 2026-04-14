from django.http import JsonResponse

# dizionario che associa codice di errore HTTP al relativo messaggio descrittivo
API_ERRORS = {
    400: "Bad Request. Invalid input.",
    401: "Unauthorized. Authentication token is missing or invalid.",
    403: "Forbidden. The user is authenticated but does not have the necessary permissions to perform this specific action (e.g., delete a message that is not theirs).",
    404: "Not Found. The requested resource does not exist.",
    405: "Method Not Allowed. The HTTP method is not supported for this endpoint.",
    409: "Conflict. The request conflicts with the current state.",
    500: "Internal Server Error. An unexpected error occurred on the server."
}

# funzione helper che, dato il codice, crea in automatico la risposta JSON contenente l'Errore (code + message)
def error_response(status_code):
    message = API_ERRORS.get(status_code, "Unknown Error. An unexpected issue occurred.")
    return JsonResponse({
        "code": str(status_code), 
        "message": message
    }, status=status_code)