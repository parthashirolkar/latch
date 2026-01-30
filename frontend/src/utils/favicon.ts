export async function fetchFavicon(url: string): Promise<string | null> {
  try {
    let formattedUrl = url.trim()
    
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`
    }
    
    const domain = new URL(formattedUrl).hostname
    console.log('Fetching favicon for domain:', domain)

    // Use DuckDuckGo favicon service - works great for img tags (no CORS issues with img loading)
    const ddgoUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`
    console.log('Using DuckDuckGo favicon URL:', ddgoUrl)
    
    return ddgoUrl
  } catch (error) {
    console.error('Error in fetchFavicon:', error)
    return null
  }
}
