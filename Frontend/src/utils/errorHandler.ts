// Utility function to format API error messages
export const formatApiError = (error: any): string => {
  // Check if it's an Axios error with response
  if (error?.response?.data) {
    const data = error.response.data

    // ASP.NET Core validation error format
    if (data.errors && typeof data.errors === 'object') {
      const errorMessages: string[] = []
      
      // Extract all validation error messages
      Object.entries(data.errors).forEach(([field, messages]) => {
        if (Array.isArray(messages)) {
          messages.forEach((msg) => {
            // Clean up field names (remove $. prefix and convert to readable format)
            const cleanField = field.replace(/^\$\./, '').replace(/([A-Z])/g, ' $1').trim()
            errorMessages.push(`${cleanField}: ${msg}`)
          })
        }
      })
      
      if (errorMessages.length > 0) {
        return errorMessages.join('; ')
      }
    }

    // Single message format
    if (data.message) {
      return data.message
    }

    // Error field format (common in custom API responses)
    if (data.error) {
      return data.error
    }

    // Title format (common in ASP.NET Core)
    if (data.title) {
      return data.title
    }

    // Detail format
    if (data.detail) {
      return data.detail
    }
  }

  // Fallback to error message
  if (error?.message) {
    return error.message
  }

  return 'An unexpected error occurred'
}
