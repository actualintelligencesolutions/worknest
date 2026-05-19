<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Notifications;

final class Mailer
{
    public function sendAdminOtp(string $email, string $otp, string $companyName): bool
    {
        if (!function_exists('mail')) {
            return false;
        }

        $subject = 'Your Worknest admin verification code';
        $message = "Use this OTP to verify the admin account for {$companyName}: {$otp}\n\nThis code expires in 10 minutes.";
        $headers = 'From: no-reply@worknest.local';

        return @mail($email, $subject, $message, $headers);
    }

    public function sendSiteOwnerInvite(
        string $email,
        string $workspaceName,
        string $branchName,
        string $acceptUrl
    ): bool {
        if (!function_exists('mail')) {
            return false;
        }

        $subject = 'You were invited to manage a Worknest branch';
        $message = "You were invited to join {$workspaceName} as the site owner for {$branchName}.\n\n"
            . "Accept your invitation here: {$acceptUrl}\n\n"
            . 'This invite link will let you create your account and access the assigned branch tools.';
        $headers = 'From: no-reply@worknest.local';

        return @mail($email, $subject, $message, $headers);
    }

    public function sendSiteOwnerAccessGranted(
        string $email,
        string $workspaceSlug,
        string $workspaceName,
        string $branchName
    ): bool {
        if (!function_exists('mail')) {
            return false;
        }

        $subject = 'Your Worknest branch access is ready';
        $message = "You now have site owner access to {$branchName} in {$workspaceName}.\n\n"
            . "Sign in using your workspace link: /login/{$workspaceSlug}\n\n"
            . 'If you already use Worknest, you can sign in with your existing email and password.';
        $headers = 'From: no-reply@worknest.local';

        return @mail($email, $subject, $message, $headers);
    }
}
