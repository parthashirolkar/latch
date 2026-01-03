using System;
using Windows.Security.Credentials.UI;

namespace LatchAuthHelper;

class Program
{
    static int Main(string[] args)
    {
        if (args.Length == 0 || args[0] == "--help" || args[0] == "-h")
        {
            PrintHelp();
            return 1;
        }

        if (args[0] == "--reason" && args.Length >= 2)
        {
            return Authenticate(args[1]);
        }

        Console.Error.WriteLine("Invalid arguments");
        PrintHelp();
        return 1;
    }

    static int Authenticate(string reason)
    {
        try
        {
            var result = UserConsentVerifier.RequestVerificationAsync(reason).AsTask().GetAwaiter().GetResult();
            
            switch (result)
            {
                case UserConsentVerificationResult.Verified:
                    return 0;
                case UserConsentVerificationResult.DeviceNotPresent:
                case UserConsentVerificationResult.NotConfigured:
                    Console.Error.WriteLine("Windows Hello is not available or not configured");
                    return 1;
                case UserConsentVerificationResult.DisabledByPolicy:
                    Console.Error.WriteLine("Windows Hello is disabled by policy");
                    return 1;
                case UserConsentVerificationResult.Canceled:
                    Console.Error.WriteLine("Authentication cancelled by user");
                    return 1;
                default:
                    Console.Error.WriteLine($"Authentication failed: {result}");
                    return 1;
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error during authentication: {ex.Message}");
            return 1;
        }
    }

    static void PrintHelp()
    {
        Console.WriteLine("auth-helper.exe --reason <message>");
        Console.WriteLine();
        Console.WriteLine("Exit codes:");
        Console.WriteLine("  0 - authenticated");
        Console.WriteLine("  1 - failed / cancelled / unavailable");
    }
}
