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
}
