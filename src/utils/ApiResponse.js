
class ApiResponse {

    constructor( statusCode , data , message="success" ){
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400
    }
}

export { ApiResponse }

// 400 - 499 -> client errors
// 500 - 599 -> server erros 

// the condition will evalute to false , and this.succes will be set to false 